// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";

contract MockTip20Token is ITIP20 {
    bytes32 public constant BURN_BLOCKED_ROLE = keccak256("BURN_BLOCKED_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant UNPAUSE_ROLE = keccak256("UNPAUSE_ROLE");

    string public name;
    string public symbol;
    string public currency;

    ITIP20 public quoteToken;
    ITIP20 public nextQuoteToken;

    uint64 public transferPolicyId;
    bool public paused;
    uint256 public totalSupply;
    uint256 public supplyCap;
    uint256 public globalRewardPerToken;
    uint128 public optedInSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    mapping(address => address) private _rewardRecipients;
    mapping(address => uint256) private _rewardBalance;
    mapping(address => uint256) private _rewardPerToken;

    uint256 public lastReward;
    bytes32 public lastMemo;
    bool public initialized;
    address public admin;

    // Role-based access control (optional strict mode)
    bool public strictRoles;
    mapping(bytes32 => mapping(address => bool)) private _roles;

    constructor(string memory tokenName, string memory tokenSymbol, string memory tokenCurrency, ITIP20 tokenQuote) {
        name = tokenName;
        symbol = tokenSymbol;
        currency = tokenCurrency;
        quoteToken = tokenQuote;
        admin = msg.sender;
        initialized = true;
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenCurrency,
        ITIP20 tokenQuote
    ) external {
        require(!initialized, "Initialized");
        name = tokenName;
        symbol = tokenSymbol;
        currency = tokenCurrency;
        quoteToken = tokenQuote;
        admin = msg.sender;
        initialized = true;
    }

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance();
        }
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function transferWithMemo(address to, uint256 amount, bytes32 memo) external {
        _transfer(msg.sender, to, amount);
        lastMemo = memo;
        emit TransferWithMemo(msg.sender, to, amount, memo);
    }

    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance();
        }
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        lastMemo = memo;
        emit TransferWithMemo(from, to, amount, memo);
        return true;
    }

    function systemTransferFrom(address from, address to, uint256 amount) external returns (bool) {
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        if (strictRoles && !_roles[ISSUER_ROLE][msg.sender]) {
            revert("MockTip20Token: missing ISSUER_ROLE");
        }
        _mint(to, amount);
    }

    function mintWithMemo(address to, uint256 amount, bytes32 memo) external {
        _mint(to, amount);
        lastMemo = memo;
        emit TransferWithMemo(address(0), to, amount, memo);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnWithMemo(uint256 amount, bytes32 memo) external {
        _burn(msg.sender, amount);
        lastMemo = memo;
    }

    function burnBlocked(address from, uint256 amount) external {
        _burn(from, amount);
        emit BurnBlocked(from, amount);
    }

    function pause() external {
        paused = true;
        emit PauseStateUpdate(msg.sender, true);
    }

    function unpause() external {
        paused = false;
        emit PauseStateUpdate(msg.sender, false);
    }

    function changeTransferPolicyId(uint64 newPolicyId) external {
        transferPolicyId = newPolicyId;
        emit TransferPolicyUpdate(msg.sender, newPolicyId);
    }

    function setNextQuoteToken(ITIP20 newQuoteToken) external {
        nextQuoteToken = newQuoteToken;
        emit NextQuoteTokenSet(msg.sender, newQuoteToken);
    }

    function completeQuoteTokenUpdate() external {
        quoteToken = nextQuoteToken;
        emit QuoteTokenUpdate(msg.sender, quoteToken);
    }

    function setRewardRecipient(address newRewardRecipient) external {
        _rewardRecipients[msg.sender] = newRewardRecipient;
        emit RewardRecipientSet(msg.sender, newRewardRecipient);
    }

    function setSupplyCap(uint256 newSupplyCap) external {
        supplyCap = newSupplyCap;
        emit SupplyCapUpdate(msg.sender, newSupplyCap);
    }

    function distributeReward(uint256 amount) external {
        lastReward = amount;
        emit RewardDistributed(msg.sender, amount);
    }

    function transferFeePreTx(address, uint256) external {}

    function transferFeePostTx(address, uint256, uint256) external {}

    function claimRewards() external returns (uint256 maxAmount) {
        maxAmount = _rewardBalance[msg.sender];
        _rewardBalance[msg.sender] = 0;
    }

    function userRewardInfo(address account)
        external
        view
        returns (address rewardRecipient, uint256 rewardPerToken, uint256 rewardBalance)
    {
        rewardRecipient = _rewardRecipients[account];
        if (rewardRecipient == address(0)) {
            rewardRecipient = account;
        }
        rewardPerToken = _rewardPerToken[account];
        rewardBalance = _rewardBalance[account];
    }

    function getPendingRewards(address account) external view returns (uint256) {
        return _rewardBalance[account];
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (paused) revert ContractPaused();
        if (to == address(0)) revert InvalidRecipient();
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) {
            revert InsufficientBalance(fromBalance, amount, from);
        }
        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) {
            revert InsufficientBalance(fromBalance, amount, from);
        }
        balanceOf[from] = fromBalance - amount;
        totalSupply -= amount;
        emit Burn(from, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    // ============ Test Helpers ============

    /// @notice Enables strict role checking for mint/burn operations
    /// @param enabled Whether to enforce role checks
    function setStrictRoles(bool enabled) external {
        strictRoles = enabled;
    }

    /// @notice Grants a role to an account
    /// @param role The role identifier (e.g., ISSUER_ROLE)
    /// @param account The account to grant the role to
    function grantRole(bytes32 role, address account) external {
        _roles[role][account] = true;
    }

    /// @notice Revokes a role from an account
    /// @param role The role identifier
    /// @param account The account to revoke the role from
    function revokeRole(bytes32 role, address account) external {
        _roles[role][account] = false;
    }

    /// @notice Checks if an account has a role
    /// @param role The role identifier
    /// @param account The account to check
    /// @return Whether the account has the role
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }
}
