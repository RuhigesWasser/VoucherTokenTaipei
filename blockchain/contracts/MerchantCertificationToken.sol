// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerchantCertificationToken
 * @dev 基于 ERC-721 的商户认证 Token 合约，每个 Token 附带一个 merchantTypeId 用于表示商户类型，
 * 同时增加了过期时间属性（expirationTime），可由发行者在认证过期或其他需要时销毁 Token。
 * 此外，通过重写转移函数保证Authentication Token is not transferable。
 */
contract MerchantCertificationToken is ERC721, Ownable {
    // 记录每个认证 Token 的商户类型
    mapping(uint256 => uint256) public merchantTypeId;

    // 记录每个认证 Token 的过期时间（时间戳）
    mapping(uint256 => uint256) public expirationTime;

    // 内部 TokenId 计数器
    uint256 private _tokenIdCounter;

    /**
     * @dev 构造函数，设置 ERC721 的名称和符号
     * @param name 合约名称
     * @param symbol 代币符号
     */
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {}

    /**
     * @dev 仅允许合约拥有者调用，为指定地址铸造一枚认证 Token，并记录对应的商户类型和过期时间。
     * @param to 接收认证 Token 的地址
     * @param _merchantTypeId 商户类型标识
     * @param _expirationTime Token 过期的时间戳，必须大于当前区块时间
     */
    function mintCertification(
        address to,
        uint256 _merchantTypeId,
        uint256 _expirationTime
    ) external onlyOwner {
        require(
            _expirationTime > block.timestamp,
            "Expiration must be in the future"
        );
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        merchantTypeId[newTokenId] = _merchantTypeId;
        expirationTime[newTokenId] = _expirationTime;
        _safeMint(to, newTokenId);
    }

    /**
     * @dev 检查指定 Token 是否已过期。
     * @param tokenId 认证 Token 的 ID
     * @return true 表示已过期，false 表示仍有效
     */
    function isExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp > expirationTime[tokenId];
    }

    /**
     * @dev 由发行者调用，用于销毁指定的认证 Token（例如认证过期或取消认证）。
     * @param tokenId 认证 Token 的 ID
     */
    function revokeCertification(uint256 tokenId) external onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        _burn(tokenId);

        delete merchantTypeId[tokenId];
        delete expirationTime[tokenId];
    }

    // 在合约内添加此方法即可实现不可转移功能
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(
            from == address(0) || to == address(0),
            "Authentication Token is not transferable"
        );
        return super._update(to, tokenId, auth);
    }
}
