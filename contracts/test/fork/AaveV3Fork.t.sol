// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AaveV3Adapter} from "../../src/adapters/AaveV3Adapter.sol";
import {IAaveV3Pool} from "../../src/interfaces/IAaveV3.sol";

/// @notice Runs against Arbitrum Sepolia when ARBITRUM_SEPOLIA_RPC is set, otherwise skips.
contract AaveV3ForkTest is Test {
    address constant USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant POOL = 0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff;
    address beneficiary = address(0xBEEF);

    function test_suppliesCircleUsdcToAave() public {
        string memory rpc = vm.envOr("ARBITRUM_SEPOLIA_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc);

        AaveV3Adapter adapter = new AaveV3Adapter();
        deal(USDC, address(this), 10e6);
        IERC20(USDC).approve(address(adapter), 10e6);

        bytes memory result =
            adapter.deposit(USDC, 10e6, bytes32(uint256(uint160(beneficiary))), abi.encode(POOL, 10e6 - 1));

        (address aToken, uint256 received) = abi.decode(result, (address, uint256));
        assertEq(aToken, IAaveV3Pool(POOL).getReserveData(USDC).aTokenAddress);
        assertApproxEqAbs(received, 10e6, 1);
        assertApproxEqAbs(IERC20(aToken).balanceOf(beneficiary), 10e6, 1);
    }
}
