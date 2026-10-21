// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Учебный пример: хранилище одного ERC-20 токена с базовыми защитами.
 * НЕ аудирован. Не использовать с реальными деньгами без тестов, fuzz/invariant,
 * статанализа (Slither) и внешнего аудита.
 *
 * Что демонстрируется:
 *  - Checks-Effects-Interactions + ReentrancyGuard
 *  - SafeERC20 (токены, не возвращающие bool) и учёт фактически полученной суммы (fee-on-transfer)
 *  - Роли AccessControl вместо одного owner; админ — мультисиг за timelock (вне контракта)
 *  - Pausable для экстренной остановки
 *  - Лимит вывода за окно (ограничивает ущерб при баге/компрометации)
 *  - Явные custom errors, события для мониторинга
 */
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SafeVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant LIMIT_ADMIN_ROLE = keccak256("LIMIT_ADMIN_ROLE");

    IERC20 public immutable asset;

    mapping(address => uint256) public balanceOf;
    uint256 public totalDeposits;

    // глобальный лимит вывода за окно
    uint256 public withdrawLimitPerWindow;
    uint256 public constant WINDOW = 1 days;
    uint256 public windowStart;
    uint256 public withdrawnInWindow;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event WithdrawLimitChanged(uint256 oldLimit, uint256 newLimit);

    error ZeroAmount();
    error InsufficientBalance(uint256 requested, uint256 available);
    error WithdrawLimitExceeded(uint256 requested, uint256 remaining);
    error ZeroAddress();

    constructor(IERC20 asset_, address admin, address pauser, uint256 limit) {
        if (address(asset_) == address(0) || admin == address(0) || pauser == address(0)) revert ZeroAddress();
        asset = asset_;
        // admin должен быть мультисигом за timelock, а не EOA разработчика
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LIMIT_ADMIN_ROLE, admin);
        // pauser может быть «быстрым» ключом: пауза безопаснее, чем снятие паузы
        _grantRole(PAUSER_ROLE, pauser);
        withdrawLimitPerWindow = limit;
        windowStart = block.timestamp;
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        // учитываем фактически полученное (fee-on-transfer токены)
        uint256 before = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - before;

        balanceOf[msg.sender] += received;
        totalDeposits += received;
        emit Deposited(msg.sender, received);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        // Checks
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balanceOf[msg.sender];
        if (amount > bal) revert InsufficientBalance(amount, bal);
        _consumeWithdrawLimit(amount);

        // Effects — ДО внешнего вызова
        balanceOf[msg.sender] = bal - amount;
        totalDeposits -= amount;

        // Interactions — последним
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function _consumeWithdrawLimit(uint256 amount) internal {
        if (block.timestamp >= windowStart + WINDOW) {
            windowStart = block.timestamp;
            withdrawnInWindow = 0;
        }
        // лимит могли уменьшить ниже уже выведенного — не допускаем underflow
        uint256 remaining = withdrawLimitPerWindow > withdrawnInWindow ? withdrawLimitPerWindow - withdrawnInWindow : 0;
        if (amount > remaining) revert WithdrawLimitExceeded(amount, remaining);
        withdrawnInWindow += amount;
    }

    function setWithdrawLimit(uint256 newLimit) external onlyRole(LIMIT_ADMIN_ROLE) {
        emit WithdrawLimitChanged(withdrawLimitPerWindow, newLimit);
        withdrawLimitPerWindow = newLimit;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    // снятие паузы — только админом (мультисиг + timelock)
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // Инвариант для fuzz/invariant-тестов (Foundry):
    //   asset.balanceOf(address(this)) >= totalDeposits
    //   sum(balanceOf[u]) == totalDeposits
}
