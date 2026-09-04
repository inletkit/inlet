// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {InletHub} from "../src/InletHub.sol";

/// @notice Registers one destination and one receiver on the hub.
contract ConfigureHub is Script {
    function run() external {
        InletHub hub = InletHub(vm.envAddress("HUB"));
        uint32 domain = uint32(vm.envUint("DOMAIN"));
        InletHub.Kind kind = InletHub.Kind(vm.envUint("KIND"));
        bytes32 forwarder = vm.envOr("FORWARDER", bytes32(0));
        bytes32 receiver = vm.envBytes32("RECEIVER");
        bytes memory strkey = bytes(vm.envOr("STRKEY", string("")));
        uint16 maxFeeBps = uint16(vm.envOr("MAX_FEE_BPS", uint256(0)));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        hub.setDestination(domain, kind, forwarder, maxFeeBps);
        hub.setReceiver(domain, receiver, true, strkey);
        vm.stopBroadcast();

        console.log("configured domain", domain);
    }
}
