// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {ITIP20Factory} from "tempo-std/interfaces/ITIP20Factory.sol";
import {ITIP20RolesAuth} from "tempo-std/interfaces/ITIP20RolesAuth.sol";
import {IStablecoinDEX} from "tempo-std/interfaces/IStablecoinDEX.sol";

import {RepoTokenRegistry} from "../../src/RepoTokenRegistry.sol";
import {RepoTokenLauncher} from "../../src/RepoTokenLauncher.sol";
import {MaintainerClaims} from "../../src/MaintainerClaims.sol";
import {RepoTreasury} from "../../src/RepoTreasury.sol";
import {IRepoTokenLauncher} from "../../src/interfaces/IRepoTokenLauncher.sol";
import {IRepoTokenRegistry} from "../../src/interfaces/IRepoTokenRegistry.sol";
import {IRepoTreasury} from "../../src/interfaces/IRepoTreasury.sol";
import {IMaintainerClaims} from "../../src/interfaces/IMaintainerClaims.sol";
import {TestBase} from "../utils/TestBase.sol";

/// @title IntegrationBase
/// @notice Shared setup and helpers for integration tests against Tempo Moderato
/// @dev Inherits signature helpers from TestBase; deploys contracts fresh each test run
abstract contract IntegrationBase is TestBase {
    uint256 internal constant TEMPO_CHAIN_ID = 42431;

    // Precompiles (always available on Tempo)
    ITIP20Factory internal factory = StdPrecompiles.TIP20_FACTORY;
    IStablecoinDEX internal dex = StdPrecompiles.STABLECOIN_DEX;
    ITIP20 internal pathUsd = StdTokens.PATH_USD;

    // Deployed contracts (deployed fresh in setUp)
    IRepoTokenRegistry internal registry;
    IRepoTokenLauncher internal launcher;
    IMaintainerClaims internal claims;

    // Test accounts
    uint256 internal backendKey;
    address internal backend;

    // Common test addresses
    address internal user1;
    address internal user2;
    address internal user3;
    address internal maintainer;
    address internal trader;

    /// @notice Skip test if not running on Tempo testnet
    modifier onlyTempo() {
        if (block.chainid != TEMPO_CHAIN_ID) {
            vm.skip(true, "requires Tempo testnet fork");
            return;
        }
        _;
    }

    /// @notice Skip test if deployed contracts not available
    modifier requiresDeployedContracts() {
        if (address(launcher) == address(0) || address(registry) == address(0)) {
            vm.skip(true, "contracts not deployed");
            return;
        }
        _;
    }

    function setUp() public virtual {
        if (block.chainid != TEMPO_CHAIN_ID) return;

        // Generate backend key for signing
        backendKey = uint256(keccak256("integration-test-backend"));
        backend = vm.addr(backendKey);

        // Create test accounts
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        maintainer = makeAddr("maintainer");
        trader = makeAddr("trader");

        // Fund test accounts via Tempo faucet RPC
        _fundViaFaucet(address(this));
        _fundViaFaucet(user1);
        _fundViaFaucet(user2);
        _fundViaFaucet(user3);
        _fundViaFaucet(maintainer);
        _fundViaFaucet(trader);
        _fundViaFaucet(backend);

        // Deploy contracts fresh
        _deployContracts();
    }

    /// @notice Deploy all contracts fresh for this test run
    function _deployContracts() internal {
        address admin = address(this);

        // Deploy registry (admin)
        registry = IRepoTokenRegistry(address(new RepoTokenRegistry(admin)));

        // Deploy treasury implementation (for cloning)
        address treasuryImpl = address(new RepoTreasury());

        // Deploy claims (admin, backendSigner, registry)
        claims = IMaintainerClaims(address(new MaintainerClaims(admin, backend, address(registry))));

        // Deploy launcher (registry, maintainerClaims, backend, admin, treasuryImplementation)
        launcher = IRepoTokenLauncher(
            address(new RepoTokenLauncher(address(registry), address(claims), backend, admin, treasuryImpl))
        );

        // Configure registry to accept launcher
        RepoTokenRegistry(address(registry)).setLauncher(address(launcher));
    }

    // ============ Faucet ============

    /// @notice Fund an address using Tempo's faucet RPC
    /// @dev Calls tempo_fundAddress which grants 1M of each test stablecoin
    function _fundViaFaucet(address to) internal {
        // Call Tempo's faucet RPC method
        // This gives 1M PathUSD, AlphaUSD, BetaUSD, ThetaUSD
        string memory addrStr = vm.toString(to);
        vm.rpc("tempo_fundAddress", string(abi.encodePacked("[\"", addrStr, "\"]")));
    }

    // ============ Token Helpers ============

    /// @notice Create a new TIP-20 token via the factory
    function _createToken(string memory name, string memory symbol) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(name, symbol, block.timestamp, block.number));
        return factory.createToken(name, symbol, "USD", pathUsd, address(this), salt);
    }

    /// @notice Create token and mint initial supply
    function _createAndMintToken(string memory name, string memory symbol, address to, uint256 amount)
        internal
        returns (address token)
    {
        token = _createToken(name, symbol);
        // Grant ISSUER_ROLE to mint (real TIP-20 tokens require this)
        bytes32 issuerRole = ITIP20(token).ISSUER_ROLE();
        ITIP20RolesAuth(token).grantRole(issuerRole, address(this));
        ITIP20(token).mint(to, amount);
    }

    // ============ Launch Helpers ============

    /// @notice Generate a unique repo hash for testing
    function _uniqueRepoHash(string memory prefix) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(prefix, block.timestamp, block.number, msg.sender));
    }

    /// @notice Deposit PathUSD to a launch as a specific user
    function _depositAs(address user, bytes32 repoHash, uint256 amount) internal {
        vm.startPrank(user);
        pathUsd.approve(address(launcher), amount);
        launcher.deposit(repoHash, amount);
        vm.stopPrank();
    }

    // ============ Funding Helpers ============

    /// @notice Fund an address with PathUSD (transfers from this contract)
    function _fundWithPathUsd(address to, uint256 amount) internal {
        pathUsd.transfer(to, amount);
    }
}
