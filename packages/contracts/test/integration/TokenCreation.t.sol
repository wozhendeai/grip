// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {ITIP20RolesAuth} from "tempo-std/interfaces/ITIP20RolesAuth.sol";
import {IntegrationBase} from "./Integration.base.sol";
import {IRepoTokenLauncher} from "../../src/interfaces/IRepoTokenLauncher.sol";
import {IRepoTokenRegistry} from "../../src/interfaces/IRepoTokenRegistry.sol";

/// @title TokenCreationTest
/// @notice Integration tests for TIP-20 Factory precompile
contract TokenCreationTest is IntegrationBase {
    function test_CreateToken() public onlyTempo {
        bytes32 salt = keccak256(abi.encodePacked("test-create", block.timestamp));

        address token = factory.createToken("Integration Token", "INTG", "USD", pathUsd, address(this), salt);

        assertTrue(factory.isTIP20(token), "should be TIP-20");
        assertEq(ITIP20(token).name(), "Integration Token");
        assertEq(ITIP20(token).symbol(), "INTG");
    }

    function test_TokenHasCorrectMetadata() public onlyTempo {
        address token = _createToken("Metadata Test", "META");

        assertEq(ITIP20(token).name(), "Metadata Test");
        assertEq(ITIP20(token).symbol(), "META");
        assertEq(ITIP20(token).currency(), "USD");
        assertEq(ITIP20(token).decimals(), 6);
    }

    function test_TokenHasQuoteToken() public onlyTempo {
        address token = _createToken("Quote Test", "QUOT");

        assertEq(address(ITIP20(token).quoteToken()), address(pathUsd));
    }

    function test_TokenIsTIP20() public onlyTempo {
        address token = _createToken("TIP20 Check", "T20");

        assertTrue(factory.isTIP20(token));
        assertFalse(factory.isTIP20(address(0x1234)));
        assertFalse(factory.isTIP20(address(this)));
    }

    function test_TransferWithMemo() public onlyTempo {
        address token = _createToken("Memo Test", "MEMO");
        address recipient = makeAddr("recipient");

        // Grant ISSUER_ROLE to this contract (admin can grant roles)
        bytes32 issuerRole = ITIP20(token).ISSUER_ROLE();
        ITIP20RolesAuth(token).grantRole(issuerRole, address(this));

        // Mint tokens to this contract
        ITIP20(token).mint(address(this), 1000e6);

        // Transfer with memo
        bytes32 memo = keccak256("payment-ref-123");
        ITIP20(token).transferWithMemo(recipient, 100e6, memo);

        assertEq(ITIP20(token).balanceOf(recipient), 100e6);
    }

    function test_LauncherCreateLaunch() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("launcher-test");

        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "Launcher Test", tokenSymbol: "LNCH", minRaise: 0, duration: 1 days
        });

        launcher.createLaunch(config);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        assertEq(launch.repoHash, repoHash);

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Launching));
    }
}
