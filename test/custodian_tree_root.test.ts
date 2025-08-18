import { assert, describe, expect, test } from 'vitest';
import { CustodianTree } from '../scripts/tree/CustodianTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress, importToken } from '../scripts/utils/tokenDB.js';
import { NativeUltraHonkBackend } from '../scripts/utils/bb.js';
import { verifyInSolidity } from '../scripts/utils/verifySol.js';

describe('custodian_tree_root', () => {
	let backendGlobal: NativeUltraHonkBackend;

	test('4 accounts', async () => {
		const threadsLeaf = 8;
		const threadsRecurse = 4;
		const threadsAcccount = 4;

		const { custodian } = await importAccounts(4);
		const tokenAddr = await getTokenAddress();

		const blockNumber = await aztecNode.getBlockNumber();
		const blockHeader = await aztecNode.getBlockHeader(blockNumber);
		assert.ok(blockHeader, 'blockHeader undefined');

		const global: Global = {
			blockHeader,
			blockNumber,
			aztecNode: aztecNode,
			tokenAddr,
		};

		const custodianTree = new CustodianTree(
			custodian,
			global,
			threadsLeaf,
			threadsRecurse,
			threadsAcccount,
		);
		const backend = await custodianTree.prove({ zk: true, skipIfExists: false });
		const result = await backend.verify({ zk: true });

		expect(result).to.be.true;

		backendGlobal = backend;
	});

	test('Solidity verifier', async () => {
		const backend = backendGlobal;

		const { proof, publicInputs } = await backend.getProofForSol();
		const { gas, result } = await verifyInSolidity(proof, publicInputs);

		console.log('gas: ', gas);
		expect(result).to.be.true;
	});
});
