// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {ITIP20Factory} from "tempo-std/interfaces/ITIP20Factory.sol";

import {MockTip20Token} from "./MockTip20Token.sol";

contract MockTip20Factory is ITIP20Factory {
    mapping(bytes32 => address) public deployedTokens;
    mapping(address => bool) private _isDeployed;

    function createToken(
        string memory name,
        string memory symbol,
        string memory currency,
        ITIP20 quoteToken,
        address admin,
        bytes32 salt
    ) external returns (address token) {
        bytes32 key = keccak256(abi.encodePacked(msg.sender, salt));
        address existing = deployedTokens[key];
        if (existing != address(0)) {
            revert TokenAlreadyExists(existing);
        }

        MockTip20Token newToken = new MockTip20Token(name, symbol, currency, quoteToken);
        token = address(newToken);
        deployedTokens[key] = token;
        _isDeployed[token] = true;

        emit TokenCreated(token, name, symbol, currency, quoteToken, admin, salt);
    }

    function isTIP20(address token) external view returns (bool) {
        return _isDeployed[token];
    }

    function getTokenAddress(address sender, bytes32 salt) external pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(sender, salt)))));
    }
}
