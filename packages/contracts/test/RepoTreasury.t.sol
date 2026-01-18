// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/RepoTreasury.sol";
import "../src/interfaces/IRepoTreasury.sol";
import "./mocks/MockMaintainerClaims.sol";
import "./mocks/MockStablecoinDex.sol";
import "./mocks/MockTip20Token.sol";
import "./utils/TestBase.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";

contract RepoTreasuryTest is TestBase {
    address private constant STABLECOIN_DEX = StdPrecompiles.STABLECOIN_DEX_ADDRESS;

    RepoTreasury private treasury;
    MockTip20Token private repoToken;
    MockTip20Token private quoteToken;
    MockMaintainerClaims private claims;

    uint256 private backendKey = 0xB0B;
    address private backend;

    bytes32 private repoHash = keccak256(abi.encodePacked("owner", "/", "repo"));

    // Track order IDs and balances for mock DEX
    uint128 private _nextOrderId = 1;
    mapping(address => mapping(address => uint128)) private _dexBalances;

    function setUp() public {
        vm.warp(1000);
        backend = vm.addr(backendKey);

        quoteToken = new MockTip20Token("PathUSD", "PUSD", "USD", ITIP20(address(0)));
        repoToken = new MockTip20Token("RepoToken", "REPO", "USD", ITIP20(address(quoteToken)));

        // Mock DEX createPair to return success
        vm.mockCall(
            STABLECOIN_DEX,
            abi.encodeWithSignature("createPair(address)", address(repoToken)),
            abi.encode(bytes32(uint256(1)))
        );

        // Mock DEX placeFlip to return incrementing order IDs
        // We'll use a more specific mock in each test that needs it

        // Mock DEX balanceOf to return 0 by default
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("balanceOf(address,address)"), abi.encode(uint128(0)));

        // Mock DEX cancel to return success
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("cancel(uint128)"), abi.encode());

        // Mock DEX withdraw to return success
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("withdraw(address,uint128)"), abi.encode());

        claims = new MockMaintainerClaims();
        treasury = new RepoTreasury();
        treasury.initialize(repoHash, address(repoToken), address(quoteToken), address(claims), backend);
    }

    function _mockPlaceFlip(uint128 returnOrderId) internal {
        vm.mockCall(
            STABLECOIN_DEX,
            abi.encodeWithSignature("placeFlip(address,uint128,bool,int16,int16)"),
            abi.encode(returnOrderId)
        );
    }

    function _mockDexBalance(address account, address token, uint128 balance) internal {
        vm.mockCall(
            STABLECOIN_DEX, abi.encodeWithSignature("balanceOf(address,address)", account, token), abi.encode(balance)
        );
    }

    function test_Initialize_OnlyOnce() public {
        vm.expectRevert(bytes("Already initialized"));
        treasury.initialize(repoHash, address(repoToken), address(quoteToken), address(claims), backend);
    }

    function test_PlaceAndCancelFlipOrder() public {
        repoToken.mint(address(treasury), 1_000_000);

        // Mock the DEX placeFlip to return order ID 1
        _mockPlaceFlip(1);

        vm.prank(backend);
        uint128 orderId = treasury.placeFlipOrder(1_000_000, 10, 20, false);

        IRepoTreasury.FlipOrderInfo memory info = treasury.getFlipOrder(orderId);
        assertTrue(info.active, "order active");
        assertEq(uint256(info.amount), 1_000_000, "amount");

        uint128[] memory orders = treasury.getActiveOrders();
        assertEq(orders.length, 1, "active count");

        vm.prank(backend);
        treasury.cancelOrder(orderId);

        orders = treasury.getActiveOrders();
        assertEq(orders.length, 0, "active cleared");
    }

    function test_PlaceFlipOrder_AuthAndAmount() public {
        vm.expectRevert(IRepoTreasury.Unauthorized.selector);
        treasury.placeFlipOrder(100, 10, 20, false);

        vm.expectRevert(IRepoTreasury.InvalidAmount.selector);
        vm.prank(backend);
        treasury.placeFlipOrder(0, 10, 20, false);
    }

    function test_HarvestRevenueAndSplit() public {
        // Mock DEX balance for treasury
        _mockDexBalance(address(treasury), address(quoteToken), 1000);

        // Also need to fund quote token so withdraw works
        quoteToken.mint(address(treasury), 1000);

        uint256 harvested = treasury.harvestRevenue();
        assertEq(harvested, 1000, "harvested");
        assertEq(treasury.pendingRevenue(), 1000, "pending revenue");

        treasury.executeSplit();

        assertEq(treasury.maintainerPool(), 300, "maintainer pool");
        assertEq(treasury.bountyPool(), 400, "bounty pool");
    }

    function test_WithdrawMaintainerFees() public {
        _mockDexBalance(address(treasury), address(quoteToken), 1000);
        quoteToken.mint(address(treasury), 1000);
        treasury.harvestRevenue();
        treasury.executeSplit();

        address maintainer = address(0xCAFE);
        claims.setVerified(repoHash, maintainer, true);

        uint256 amount = 200;
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signWithdrawal(backendKey, repoHash, maintainer, maintainer, amount, expiry);

        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, amount, expiry, signature);

        assertEq(treasury.maintainerPool(), 100, "pool reduced");
        assertEq(quoteToken.balanceOf(maintainer), amount, "paid out");
    }

    function test_WithdrawMaintainerFees_Reverts() public {
        address maintainer = address(0xCAFE);
        claims.setVerified(repoHash, maintainer, true);

        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signWithdrawal(backendKey, repoHash, maintainer, maintainer, 50, expiry);
        signature[0] = bytes1(uint8(signature[0]) + 1);

        vm.expectRevert(IRepoTreasury.InvalidSignature.selector);
        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, 50, expiry, signature);

        signature = signWithdrawal(backendKey, repoHash, maintainer, maintainer, 50, uint64(block.timestamp - 1));
        vm.expectRevert(IRepoTreasury.SignatureExpired.selector);
        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, 50, uint64(block.timestamp - 1), signature);
    }

    function test_FundAndPayBounty() public {
        _mockDexBalance(address(treasury), address(quoteToken), 1000);
        quoteToken.mint(address(treasury), 1000);
        treasury.harvestRevenue();
        treasury.executeSplit();

        vm.prank(backend);
        treasury.fundBounty(keccak256("bounty"), 100);
        assertEq(treasury.bountyPool(), 300, "bounty pool reduced");

        repoToken.mint(address(treasury), 500);
        address contributor = address(0xB0B1);
        vm.prank(backend);
        treasury.payBounty(contributor, 50, 25, keccak256("memo"));

        assertEq(quoteToken.balanceOf(contributor), 50, "pathusd paid");
        assertEq(repoToken.balanceOf(contributor), 25, "token paid");
    }

    function test_EmitRewards() public {
        vm.prank(backend);
        treasury.emitRewards(1000);
        assertEq(repoToken.lastReward(), 1000, "reward recorded");
    }
}
