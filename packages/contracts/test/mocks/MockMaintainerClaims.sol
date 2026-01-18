// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMaintainerClaims} from "../../src/interfaces/IMaintainerClaims.sol";

contract MockMaintainerClaims is IMaintainerClaims {
    address public override backendSigner;
    address public admin;

    mapping(bytes32 => mapping(address => Verification)) private _verifications;
    mapping(bytes32 => address[]) private _maintainerWallets;

    constructor() {
        admin = msg.sender;
        backendSigner = msg.sender;
    }

    function setVerified(bytes32 repoHash, address wallet, bool value) external {
        Verification storage v = _verifications[repoHash][wallet];
        v.wallet = wallet;
        v.active = value;
        v.expiry = value ? uint64(block.timestamp + 365 days) : 0;
        if (value) {
            _maintainerWallets[repoHash].push(wallet);
        }
    }

    function isVerifiedMaintainer(bytes32 repoHash, address wallet) external view override returns (bool) {
        Verification storage v = _verifications[repoHash][wallet];
        return v.active && block.timestamp < v.expiry;
    }

    function getVerification(bytes32 repoHash, address wallet)
        external
        view
        override
        returns (Verification memory verification)
    {
        return _verifications[repoHash][wallet];
    }

    function getMaintainers(bytes32 repoHash) external view override returns (address[] memory wallets) {
        return _maintainerWallets[repoHash];
    }

    function registerVerification(
        bytes32 repoHash,
        bytes32 githubUserIdHash,
        address wallet,
        uint64 expiry,
        bytes calldata
    ) external override {
        if (wallet == address(0)) revert InvalidWallet();
        if (block.timestamp >= expiry) revert SignatureExpired();

        Verification storage v = _verifications[repoHash][wallet];
        if (!v.active) {
            _maintainerWallets[repoHash].push(wallet);
        }
        v.githubUserIdHash = githubUserIdHash;
        v.wallet = wallet;
        v.expiry = expiry;
        v.active = true;

        emit VerificationRegistered(repoHash, githubUserIdHash, wallet, expiry);
    }

    function revokeVerification(bytes32 repoHash, address wallet) external override {
        Verification storage v = _verifications[repoHash][wallet];
        if (!v.active) revert VerificationNotFound();
        v.active = false;
        emit VerificationRevoked(repoHash, v.githubUserIdHash);
    }

    function withdraw(bytes32 repoHash, uint256 amount) external override {
        Verification storage v = _verifications[repoHash][msg.sender];
        if (!v.active) revert VerificationNotFound();
        emit MaintainerWithdrawal(repoHash, msg.sender, amount);
    }

    function setBackendSigner(address newSigner) external override {
        backendSigner = newSigner;
        emit BackendSignerUpdated(address(0), newSigner);
    }
}
