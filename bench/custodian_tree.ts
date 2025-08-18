import assert from 'assert';
import { promises as fs } from 'fs';
import path from 'path';
import { AccountTree } from '../scripts/tree/AccountTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';
import { CustodianLeafNode } from '../scripts/tree/CustodianTree/CustodianLeafNode.js';
import { CustodianInternalNode } from '../scripts/tree/CustodianTree/CustodianInternalNode.js';
import { CustodianRootNode } from '../scripts/tree/CustodianTree/CustodianRootNode.js';

async function prepareFile() {
	const resultDir = path.resolve(process.cwd(), 'bench', 'result');
	const filePath = path.join(resultDir, 'custodian_tree.json');
	return filePath;
}

async function main() {
	const { custodian } = await importAccounts(4);
	const tokenAddr = await getTokenAddress();
	const blockNumber = await aztecNode.getBlockNumber();
	const blockHeader = await aztecNode.getBlockHeader(blockNumber);
	assert.ok(blockHeader, 'blockHeader undefined');

	const sortedCustodian = custodian.sort((a, b) =>
		a.address.toBigInt() > b.address.toBigInt() ? 1 : -1,
	);

	const global: Global = {
		blockHeader,
		blockNumber,
		aztecNode: aztecNode,
		tokenAddr,
	};

	const threadsLeaf = 4;
	const threadsRecurse = 2;
	const provePromi = [];
	const accountTrees: AccountTree[] = [];
	for (let i = 0; i < 4; i++) {
		const accountTree = new AccountTree(sortedCustodian[i], global, threadsLeaf, threadsRecurse);
		accountTrees.push(accountTree);
		provePromi.push(accountTree.prove());
	}
	await Promise.all(provePromi);

	const custodianLeafNode = new CustodianLeafNode(accountTrees, global);
	const proveStartTimeLeafMs = Date.now();
	await custodianLeafNode.prove({ recursive: true, skipIfExists: false });
	const proveEndTimeLeafMs = Date.now();
	const proveTimeLeafMs = proveEndTimeLeafMs - proveStartTimeLeafMs;

	const custodianInternalNode = new CustodianInternalNode([custodianLeafNode], true, global);
	const proveStartTimeIntMs = Date.now();
	await custodianInternalNode.prove({ recursive: true, skipIfExists: false });
	const proveEndTimeIntMs = Date.now();
	const proveTimeIntMs = proveEndTimeIntMs - proveStartTimeIntMs;

	const custodianRootNode = new CustodianRootNode(custodianInternalNode, global);
	const proveStartTimeRootMs = Date.now();
	await custodianRootNode.prove({ zk: true, recursive: false, skipIfExists: false });
	const proveEndTimeRootMs = Date.now();
	const proveTimeRootMs = proveEndTimeRootMs - proveStartTimeRootMs;

	const filePath = await prepareFile();
	const data = {
		proveTimeLeafMs,
		proveTimeIntMs,
		proveTimeRootMs,
	};
	await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((err: Error) => {
		process.exit(1);
	});
