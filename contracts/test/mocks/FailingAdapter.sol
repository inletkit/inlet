// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IInletAdapter} from "../../src/interfaces/IInletAdapter.sol";

contract FailingAdapter is IInletAdapter {
    error AlwaysFails();

    function deposit(address, uint256, bytes32, bytes calldata)
        external
        pure
        returns (bytes memory)
    {
        revert AlwaysFails();
    }
}
