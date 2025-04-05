// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerchantCertificationToken.sol"; // 引入商户认证合约

/**
 * @title VoucherToken
 * @dev 基于ERC-1155的代金券合约，
 * 消费者调用 useVoucher 函数消费代金券，
 * 在兑换时需要传入商户地址及其持有的认证 Token ID，
 * 合约内部首先检查该商户是否具备有效认证，
 * 然后判断商户认证的 merchantTypeId 是否在当前代金券允许的商户类型列表中。
 */
contract VoucherToken is ERC1155, Ownable {
    // VoucherAttributes 定义代金券类型的属性
    struct VoucherAttributes {
        uint256 expiry; // 有效期截止时间（时间戳）
        uint256 maxUsage; // 允许的最大消费次数（次数）
        uint256 singleUsageLimit; // 单次消费限额（单位：代金券单位，对应原生货币金额，单位 wei）
        uint256[] allowedMerchantTypes; // 允许使用该代金券的商户类型标识列表
    }

    // 存储每个代金券类型（tokenId）的属性
    mapping(uint256 => VoucherAttributes) public voucherAttributes;

    // 记录每个消费者对某个代金券的累计消费次数（每次消费计数，不与消费数量直接挂钩）
    mapping(address => mapping(uint256 => uint256)) public consumptionCount;

    // 内部映射，用于记录某个地址是否已领取某个 tokenId 的代金券（防止重复领取）
    mapping(uint256 => mapping(address => bool)) private _voucherIssued;

    // 存储每种代金券的每个地址可认领的数量（固定额度）
    mapping(uint256 => uint256) public claimLimit;

    // 新增状态变量：记录所有可认领代金券的 tokenId 数组
    uint256[] public claimableTokenIds;

    // 商户认证合约引用
    MerchantCertificationToken public merchantCertification;

    // 事件定义，记录消费者、商户、代金券类型及消费金额
    event VoucherTypeDefined(
        uint256 indexed tokenId,
        uint256 expiry,
        uint256 maxUsage,
        uint256 singleUsageLimit,
        uint256[] allowedMerchantTypes
    );
    event VoucherMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 amount
    );
    event VoucherUsed(
        address indexed consumer,
        address indexed merchant,
        uint256 indexed tokenId,
        uint256 usageAmount
    );

    // 事件：记录认领操作
    event VoucherClaimed(
        uint256 indexed tokenId,
        address indexed claimer,
        uint256 amount
    );

    /**
     * @dev 构造函数，传入商户认证合约地址，初始化 ERC1155（URI 为空）和 Ownable。
     * @param merchantCertificationAddress 商户认证合约地址
     */
    constructor(
        address merchantCertificationAddress
    ) ERC1155("") Ownable(msg.sender) {
        require(
            merchantCertificationAddress != address(0),
            "Invalid merchant certification address"
        );
        merchantCertification = MerchantCertificationToken(
            merchantCertificationAddress
        );
    }

    /**
     * @dev 定义新的代金券类型（tokenId），只有合约拥有者可调用。
     * @param tokenId 代金券类型ID（不可重复定义）
     * @param expiry 有效期截止时间（必须大于当前时间）
     * @param maxUsage 允许的最大消费次数
     * @param singleUsageLimit 单次消费限额（单位：代金券单位，对应原生货币金额，单位 wei）
     * @param allowedMerchantTypes 允许使用该代金券的商户类型标识列表
     */
    function defineVoucherType(
        uint256 tokenId,
        uint256 expiry,
        uint256 maxUsage,
        uint256 singleUsageLimit,
        uint256[] memory allowedMerchantTypes
    ) external onlyOwner {
        require(
            voucherAttributes[tokenId].expiry == 0,
            "Voucher type already defined"
        );
        require(expiry > block.timestamp, "Expiry must be in the future");

        voucherAttributes[tokenId] = VoucherAttributes({
            expiry: expiry,
            maxUsage: maxUsage,
            singleUsageLimit: singleUsageLimit,
            allowedMerchantTypes: allowedMerchantTypes
        });

        emit VoucherTypeDefined(
            tokenId,
            expiry,
            maxUsage,
            singleUsageLimit,
            allowedMerchantTypes
        );
    }

    /**
     * @dev 根据已定义的代金券类型向指定地址增发代金券。
     * 每个地址只允许领取一次相同 tokenId 的代金券。
     * @param to 接收地址
     * @param tokenId 代金券类型ID（必须已定义）
     * @param amount 增发数量（直接对应兑换的原生货币金额，单位 wei）
     * @param data 附加数据
     */
    function mintVoucher(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external onlyOwner {
        require(
            voucherAttributes[tokenId].expiry != 0,
            "Voucher type not defined"
        );
        require(
            !_voucherIssued[tokenId][to],
            "Voucher already issued to this address"
        );

        _mint(to, tokenId, amount, data);
        _voucherIssued[tokenId][to] = true;

        emit VoucherMinted(tokenId, to, amount);
    }

    /**
     * @dev 消费代金券，调用者为消费者。
     * 在兑换时，需传入商户地址及其持有的认证 Token ID，
     * 合约内部先检查该商户是否具有有效的认证，
     * 然后验证该商户的认证 Token 的 merchantTypeId 是否在当前代金券允许的商户类型列表中。
     * 每次消费操作会计数+1，且单次消费不能超过 singleUsageLimit 的数量，
     * 消费数量直接作为兑换的原生货币金额（单位 wei），
     * 从合约预存资金中支付给商户。
     *
     * @param tokenId 代金券类型ID
     * @param usageAmount 本次消费数量（单位与代金券单位一致，直接对应支付金额）
     * @param merchant 商户地址（接收兑换资金）
     * @param merchantCertTokenId 商户认证Token的ID，用于验证商户身份及类型
     */
    function useVoucher(
        uint256 tokenId,
        uint256 usageAmount,
        address merchant,
        uint256 merchantCertTokenId
    ) external {
        // 验证传入的商户地址及其认证Token
        require(merchant != address(0), "Invalid merchant address");
        require(
            merchantCertification.ownerOf(merchantCertTokenId) == merchant,
            "Merchant does not own the certification token"
        );
        require(
            !merchantCertification.isExpired(merchantCertTokenId),
            "Merchant certification token has expired"
        );

        // 检查商户认证 Token 的类型是否在代金券允许的商户类型列表中
        uint256 merchantType = merchantCertification.merchantTypeId(
            merchantCertTokenId
        );
        VoucherAttributes memory attr = voucherAttributes[tokenId];
        bool allowed = false;
        for (uint256 i = 0; i < attr.allowedMerchantTypes.length; i++) {
            if (attr.allowedMerchantTypes[i] == merchantType) {
                allowed = true;
                break;
            }
        }
        require(allowed, "Merchant type is not allowed for this voucher");

        require(block.timestamp <= attr.expiry, "Voucher expired");
        require(
            usageAmount <= attr.singleUsageLimit,
            "Exceeds single usage limit"
        );

        // 检查消费者的消费次数是否在允许范围内，并确保持有足够代金券余额
        require(
            consumptionCount[msg.sender][tokenId] < attr.maxUsage,
            "Exceeded maximum consumption times"
        );
        require(
            balanceOf(msg.sender, tokenId) >= usageAmount,
            "Insufficient voucher balance"
        );

        // 更新消费次数并销毁相应数量的代金券
        consumptionCount[msg.sender][tokenId] += 1;
        _burn(msg.sender, tokenId, usageAmount);

        // 将兑换金额（使用量对应的原生货币金额）支付给商户
        require(
            address(this).balance >= usageAmount,
            "Contract has insufficient funds"
        );
        (bool success, ) = payable(merchant).call{value: usageAmount}("");
        require(success, "Native currency transfer failed");

        emit VoucherUsed(msg.sender, merchant, tokenId, usageAmount);
    }

    /**
     * @dev 存入原生货币（仅供合约拥有者调用，可作为明确调用入口；receive()仍可生效）。
     */
    function deposit() external payable onlyOwner {
        // 可选：记录存款日志或限制存入金额区间
    }

    /**
     * @dev 提取合约中的原生货币余额，只允许合约拥有者调用。
     * @param to 接收地址
     * @param amount 提取金额（单位 wei）
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(
            address(this).balance >= amount,
            "Insufficient contract balance"
        );
        require(to != address(0), "Cannot withdraw to zero address");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    /// @notice 仅限合约 owner 调用，铸造可被认领的代金券（铸给 owner 账户），同时指定每个地址可认领的固定数量
    /// @param tokenId 代金券类型ID（必须已定义）
    /// @param amount 代金券总数量（存于 owner 账户）
    /// @param _claimLimit 每个地址的认领额度（每个地址只能认领一次，认领数量固定为此额度）
    /// @param data 附加数据
    function mintClaimableVoucher(
        uint256 tokenId,
        uint256 amount,
        uint256 _claimLimit,
        bytes memory data
    ) external onlyOwner {
        require(
            voucherAttributes[tokenId].expiry != 0,
            "Voucher type not defined"
        );
        // 确保同一代金券类型只铸造一次可认领代金券
        require(
            claimLimit[tokenId] == 0,
            "Claimable voucher already minted for this token"
        );
        _mint(owner(), tokenId, amount, data);
        // 记录每个地址可认领的固定数量
        claimLimit[tokenId] = _claimLimit;
        // 记录 tokenId 到 claimableTokenIds 数组
        claimableTokenIds.push(tokenId);
        emit VoucherMinted(tokenId, owner(), amount);
    }

    // 定义结构体用于返回可认领代金券信息
    struct ClaimableVoucherInfo {
        uint256 tokenId;
        uint256 claimLimit;
        uint256 availableAmount;
    }

    // 新增 view 函数，返回所有可认领代金券信息
    function getClaimableVouchers()
        public
        view
        returns (ClaimableVoucherInfo[] memory)
    {
        ClaimableVoucherInfo[] memory vouchers = new ClaimableVoucherInfo[](
            claimableTokenIds.length
        );
        for (uint256 i = 0; i < claimableTokenIds.length; i++) {
            uint256 tokenId = claimableTokenIds[i];
            vouchers[i] = ClaimableVoucherInfo({
                tokenId: tokenId,
                claimLimit: claimLimit[tokenId],
                availableAmount: balanceOf(owner(), tokenId)
            });
        }
        return vouchers;
    }

    /// @notice 任何人可调用此函数认领 owner 持有的可认领代金券，且每个地址仅能认领一次
    /// @param tokenId 代金券类型ID
    /// @param data 附加数据
    function claimVoucher(uint256 tokenId, bytes memory data) external {
        // 限制每个地址每个代金券类型只能认领一次
        require(
            !_voucherIssued[tokenId][msg.sender],
            "Voucher already claimed by this address"
        );
        uint256 claimAmount = claimLimit[tokenId];
        require(claimAmount > 0, "Claimable voucher not available");
        // 检查 owner 持有的可认领代金券数量足够
        require(
            balanceOf(owner(), tokenId) >= claimAmount,
            "Not enough claimable voucher available"
        );

        // 标记 msg.sender 已认领该代金券
        _voucherIssued[tokenId][msg.sender] = true;
        // 将固定额度的代金券从 owner 转移给调用者
        _safeTransferFrom(owner(), msg.sender, tokenId, claimAmount, data);

        emit VoucherClaimed(tokenId, msg.sender, claimAmount);
    }
}
