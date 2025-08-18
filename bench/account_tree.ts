import assert from 'assert';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';
import { promises as fs } from 'fs';
import path from 'path';
import { NotesFilter } from '@aztec/stdlib/note';
import { NoteDataProvider } from '@aztec/pxe/server';
import { MAX_NOTE_PER_LEAF } from '../scripts/types/AccountTreeLeaf.js';
import { AccountLeafNode } from '../scripts/tree/AccountTree/AccountLeafNode.js';
import { AccountInternalNode } from '../scripts/tree/AccountTree/AccountInternalNode.js';
import { Global } from '../scripts/tree/share/Global.js';
import { AccountRootNode } from '../scripts/tree/AccountTree/AccountRootNode.js';

async function prepareFile() {
	const resultDir = path.resolve(process.cwd(), 'bench', 'result');
	const filePath = path.join(resultDir, 'account_tree.json');
	return filePath;
}

async function main() {
	const { custodian } = await importAccounts(1);

	const tokenAddr = await getTokenAddress();
	const blockNumber = await aztecNode.getBlockNumber();
	const blockHeader = await aztecNode.getBlockHeader(blockNumber);
	assert(blockHeader);

	const global: Global = {
		blockHeader,
		blockNumber,
		aztecNode: aztecNode,
		tokenAddr,
	};

	const notesFilter: NotesFilter = {
		contractAddress: tokenAddr,
		recipient: custodian[0].address,
	};
	const noteDataProvider = await NoteDataProvider.create(custodian[0].store);
	const noteDaos = await noteDataProvider.getNotes(notesFilter);

	const sortedNoteDaos = noteDaos
		.sort((a, b) => (a.index > b.index ? 1 : -1))
		.slice(0, MAX_NOTE_PER_LEAF);

	const leafNode = new AccountLeafNode(sortedNoteDaos, custodian[0], {
		blockHeader,
		blockNumber,
		aztecNode: aztecNode,
		tokenAddr,
	});
	const proveStartTimeLeafMs = Date.now();
	await leafNode.prove({ recursive: true, skipIfExists: false });
	const proveEndTimeLeafMs = Date.now();
	const proveTimeLeafMs = proveEndTimeLeafMs - proveStartTimeLeafMs;

	const internalNode = new AccountInternalNode([leafNode], true, custodian[0], global);
	const proveStartTimeIntMs = Date.now();
	await internalNode.prove({ recursive: true, skipIfExists: false });
	const proveEndTimeIntMs = Date.now();
	const proveTimeIntMs = proveEndTimeIntMs - proveStartTimeIntMs;

	const rootNode = new AccountRootNode(internalNode, custodian[0], global);
	const proveStartTimeRootMs = Date.now();
	await rootNode.prove({ recursive: true, skipIfExists: false });
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
