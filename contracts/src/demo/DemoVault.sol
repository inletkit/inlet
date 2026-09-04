// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Plain ERC 4626 vault over USDC for the testnet demo. No yield.
contract DemoVault is ERC4626 {
    constructor(IERC20 usdc) ERC20("Inlet Demo Vault", "idUSDC") ERC4626(usdc) {}
}
