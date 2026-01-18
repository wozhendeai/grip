// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @title TestBase
/// @notice Shared test utilities and signing helpers for Repo Token tests
abstract contract TestBase is Test {
    /// @notice Signs a maintainer verification message
    /// @param privateKey The signer's private key
    /// @param repoHash The repository hash
    /// @param githubUserIdHash Hash of the GitHub user ID
    /// @param wallet The maintainer's wallet address
    /// @param expiry Verification expiry timestamp
    /// @return signature The packed signature (r, s, v)
    function signVerification(
        uint256 privateKey,
        bytes32 repoHash,
        bytes32 githubUserIdHash,
        address wallet,
        uint64 expiry
    ) internal pure returns (bytes memory signature) {
        bytes32 message = keccak256(abi.encodePacked(repoHash, githubUserIdHash, wallet, expiry));
        bytes32 digest = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    /// @notice Signs a maintainer withdrawal message
    /// @param privateKey The backend signer's private key
    /// @param repoHash The repository hash
    /// @param maintainer The maintainer requesting withdrawal
    /// @param to The recipient address
    /// @param amount The withdrawal amount
    /// @param expiry Signature expiry timestamp
    /// @return signature The packed signature (r, s, v)
    function signWithdrawal(
        uint256 privateKey,
        bytes32 repoHash,
        address maintainer,
        address to,
        uint256 amount,
        uint64 expiry
    ) internal pure returns (bytes memory signature) {
        bytes32 message = keccak256(abi.encodePacked(repoHash, maintainer, to, amount, expiry));
        bytes32 digest = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    /// @notice Signs a bounty funding message
    /// @param privateKey The backend signer's private key
    /// @param repoHash The repository hash
    /// @param bountyId The bounty identifier
    /// @param amount The funding amount
    /// @param expiry Signature expiry timestamp
    /// @return signature The packed signature (r, s, v)
    function signBountyFunding(uint256 privateKey, bytes32 repoHash, bytes32 bountyId, uint256 amount, uint64 expiry)
        internal
        pure
        returns (bytes memory signature)
    {
        bytes32 message = keccak256(abi.encodePacked(repoHash, bountyId, amount, expiry));
        bytes32 digest = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    /// @notice Converts a message hash to an Ethereum signed message hash
    /// @param messageHash The original message hash
    /// @return The prefixed hash ready for ecrecover
    function _toEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    /// @notice Creates a deterministic address from a label
    /// @param label The label for the address
    /// @return The derived address
    function labelToAddress(string memory label) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(label)))));
    }

    /// @notice Creates a key pair from a seed
    /// @param seed The seed value
    /// @return privateKey The private key
    /// @return addr The corresponding address
    function seedToKeyPair(uint256 seed) internal pure returns (uint256 privateKey, address addr) {
        privateKey = seed;
        addr = vm.addr(seed);
    }
}
