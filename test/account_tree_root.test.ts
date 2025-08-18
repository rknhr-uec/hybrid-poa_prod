import { assert, describe, expect, test } from 'vitest';
import { AccountTree } from '../scripts/tree/AccountTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress, importToken } from '../scripts/utils/tokenDB.js';

describe('account_tree_root', () => {
	test('One proof with AccountTree', async () => {
		const threadsLeaf = 4;
		const threadsRecurse = 2;

		const { custodian } = await importAccounts(1);
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

		const accountTree = new AccountTree(custodian[0], global, threadsLeaf, threadsRecurse);
		const backend = await accountTree.prove({ recursive: false });
		const result = await backend.verify();

		expect(result).to.be.true;
		await backend.flush();
	});
});
