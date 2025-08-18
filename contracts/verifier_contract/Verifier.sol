// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import './lib.sol';

contract Verifier is HonkVerifier {
	function verifyPublic(
		bytes calldata proof,
		bytes32[] calldata publicInputs
	) public returns (bool) {
		return verify(proof, publicInputs);
	}
}
