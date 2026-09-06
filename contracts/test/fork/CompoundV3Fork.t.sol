// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CompoundV3Adapter} from "../../src/adapters/CompoundV3Adapter.sol";
import {IComet} from "../../src/interfaces/ICompoundV3.sol";

/// @notice Runs against Base Sepolia when BASE_SEPOLIA_RPC is set, otherwise skips.
contract CompoundV3ForkTest is Test {
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant COMET = 0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017;
    address beneficiary = address(0xBEEF);

    function test_suppliesCircleUsdcToCompound() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc);

        CompoundV3Adapter adapter = new CompoundV3Adapter();
        deal(USDC, address(this), 10e6);
        IERC20(USDC).approve(address(adapter), 10e6);

        bytes memory result =
            adapter.deposit(USDC, 10e6, bytes32(uint256(uint160(beneficiary))), abi.encode(COMET, 10e6 - 2));

        (address comet, uint256 gained) = abi.decode(result, (address, uint256));
        assertEq(comet, COMET);
        assertApproxEqAbs(gained, 10e6, 2);
        assertApproxEqAbs(IComet(COMET).balanceOf(beneficiary), 10e6, 2);
    }
}
