// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {InletHub} from "../src/InletHub.sol";

/// @notice Deploys the hub on Arc testnet.
contract DeployHub is Script {
    function run() external {
        address usdc = vm.envOr("USDC", address(0x3600000000000000000000000000000000000000));
        address tokenMessenger =
            vm.envOr("TOKEN_MESSENGER", address(0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA));
        uint32 localDomain = uint32(vm.envOr("LOCAL_DOMAIN", uint256(26)));
        uint256 key = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(key));

        vm.startBroadcast(key);
        InletHub hub = new InletHub(usdc, tokenMessenger, localDomain, owner);
        vm.stopBroadcast();

        console.log("InletHub", address(hub));
    }
}
