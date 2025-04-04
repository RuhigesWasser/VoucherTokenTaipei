// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev 代金券合约接口（ERC-1155）
 */
interface IVoucherToken {
    function voucherAttributes(
        uint256 tokenId
    )
        external
        view
        returns (
            uint256 faceValue,
            uint256 expiry,
            uint256 maxUsage,
            uint256 singleUsageLimit,
            uint256 merchantTypeId
        );

    function balanceOf(
        address account,
        uint256 tokenId
    ) external view returns (uint256);

    function useVoucher(
        address account,
        uint256 tokenId,
        uint256 usageAmount
    ) external;
}

/**
 * @dev 商户认证合约接口（ERC-721）
 */
interface IMerchantCertificationToken {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isExpired(uint256 tokenId) external view returns (bool);
    function merchantTypeId(uint256 tokenId) external view returns (uint256);
}

/**
 * @title RedemptionNative
 * @dev 兑换/消费合约（原生货币版）
 * 支持将代金券兑换为原生币支付（例如 ETH），并验证代金券、商户认证等条件。
 */
contract RedemptionNative is Ownable {
    IVoucherToken public voucherToken;
    IMerchantCertificationToken public merchantCert;

    event VoucherRedeemed(
        address indexed merchant,
        uint256 voucherTokenId,
        uint256 usageAmount,
        uint256 payout
    );

    /**
     * @dev 构造函数，初始化代金券合约和商户认证合约地址。
     * 注意：这里在构造函数头部调用 Ownable(msg.sender) 为基础合约传入初始拥有者。
     * @param _voucherToken 代金券合约地址
     * @param _merchantCert 商户认证合约地址
     */
    constructor(
        address _voucherToken,
        address _merchantCert
    ) Ownable(msg.sender) {
        voucherToken = IVoucherToken(_voucherToken);
        merchantCert = IMerchantCertificationToken(_merchantCert);
    }

    // fallback 用于接收原生币（例如 ETH）
    receive() external payable {}

    /**
     * @dev 兑换代金券为原生币支付
     * @param voucherTokenId 代金券类型ID
     * @param usageAmount 本次消费数量
     * @param certificationTokenId 商户认证 Token 的ID，用于验证商户资质
     */
    function redeemVoucherNative(
        uint256 voucherTokenId,
        uint256 usageAmount,
        uint256 certificationTokenId
    ) external {
        // 验证 msg.sender 为认证 Token 的持有者，且认证未过期
        require(
            merchantCert.ownerOf(certificationTokenId) == msg.sender,
            "Not owner of certification token"
        );
        require(
            !merchantCert.isExpired(certificationTokenId),
            "Certification token expired"
        );

        // 获取认证 Token 中的商户类型
        uint256 merchantType = merchantCert.merchantTypeId(
            certificationTokenId
        );

        // 获取代金券属性
        (
            uint256 faceValue,
            uint256 expiry,
            ,
            uint256 singleUsageLimit,
            uint256 voucherMerchantType
        ) = voucherToken.voucherAttributes(voucherTokenId);

        require(block.timestamp <= expiry, "Voucher expired");
        require(usageAmount <= singleUsageLimit, "Exceeds single usage limit");
        require(
            merchantType == voucherMerchantType,
            "Voucher not applicable to this merchant type"
        );

        // 检查商户持有足够数量的代金券
        require(
            voucherToken.balanceOf(msg.sender, voucherTokenId) >= usageAmount,
            "Insufficient voucher balance"
        );

        // 调用代金券合约，消耗对应数量的代金券
        voucherToken.useVoucher(msg.sender, voucherTokenId, usageAmount);

        // 计算应支付的原生币金额，并转账给商户
        uint256 payout = faceValue * usageAmount;
        require(
            address(this).balance >= payout,
            "Insufficient native funds in contract"
        );

        payable(msg.sender).transfer(payout);

        emit VoucherRedeemed(msg.sender, voucherTokenId, usageAmount, payout);
    }

    /**
     * @dev 发行者可向合约注入原生币资金，用于兑换支付
     */
    function deposit() external payable onlyOwner {}

    /**
     * @dev 发行者可提取合约中的剩余原生币资金
     * @param amount 提取金额
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(msg.sender).transfer(amount);
    }
}
