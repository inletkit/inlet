// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {InletReceiver} from "../src/InletReceiver.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";

/// @notice Deploys the adapter named by NAME and registers it on RECEIVER.
contract DeployAdapter is Script {
    function run() external {
        string memory name = vm.envString("NAME");
        InletReceiver receiver = InletReceiver(vm.envAddress("RECEIVER"));
        bytes32 id = keccak256(bytes(string.concat(name, ":v1")));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        address adapter = _deploy(name);
        receiver.setAdapter(id, adapter);
        vm.stopBroadcast();

        console.log(name, adapter);
    }

    function _deploy(string memory name) internal returns (address) {
        bytes32 key = keccak256(bytes(name));
        if (key == keccak256("aave-v3")) return address(new AaveV3Adapter());
        revert("unknown adapter name");
    }
}
