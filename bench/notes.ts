import assert from 'assert';
import { promises as fs } from 'fs';
import path from 'path';
import { AccountTree } from '../scripts/tree/AccountTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { AztecAccount } from '../scripts/utils/account.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { logger } from '../scripts/utils/logger.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';

const threadsLeaf = 8;
const threadsRecurse = 4;

async function bench(global: Global, account: AztecAccount, num: number) {
	const accountTree = new AccountTree(account, global, threadsLeaf, threadsRecurse);

	const proveStartTimeMs = Date.now();
	const backend = await accountTree.prove(
		{
			recursive: true,
			skipIfExists: false,
			flushChild: true,
		},
		num,
	);
	const proveEndTimeMs = Date.now();
	const proveTimeSec = (proveEndTimeMs - proveStartTimeMs) / 1000;

	const { proof } = await backend.readProof();
	const proofSizeBit = proof.length * 254;

	await backend.flush();

	return { proveTimeSec, proofSizeBit };
}

async function prepareFile() {
	const resultDir = path.resolve(process.cwd(), 'bench', 'result');
	const csvPath = path.join(resultDir, 'notes.csv');
	await fs.mkdir(resultDir, { recursive: true });

	try {
		await fs.access(csvPath);
	} catch {
		await fs.writeFile(csvPath, 'num,proveTimeSec,proofSizeBit\n', 'utf8');
	}

	return csvPath;
}

async function main() {
	const { custodian } = await importAccounts(1000);
	const account = custodian[0];

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

	const filePath = await prepareFile();

	const numOfNotes = [32, 100, 500, 1000];
	for (const num of numOfNotes) {
		logger.info(`==== TESTING ${num} NOTES ====`);

		const { proveTimeSec, proofSizeBit } = await bench(global, account, num);

		const line = `${num},${proveTimeSec},${proofSizeBit}`;
		await fs.appendFile(filePath, line + '\n', 'utf8');
		logger.info(`Wrote bench result: ${line}`);
	}
}

main()
	.then(() => {
		logger.info('Notes Bench Complete');
		process.exit(0);
	})
	.catch((err: Error) => {
		logger.error('Failed: ', { error: err.message, stack: err.stack });
		process.exit(1);
	});
