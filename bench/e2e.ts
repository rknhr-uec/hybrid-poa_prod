import assert from 'assert';
import { CustodianTree } from '../scripts/tree/CustodianTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';
import { verifyInSolidity } from '../scripts/utils/verifySol.js';
import { AztecAccount } from '../scripts/utils/account.js';
import { logger } from '../scripts/utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';

const threadsLeaf = 8;
const threadsRecurse = 4;
const threadsAcccount = 4;

async function bench(global: Global, custodian: AztecAccount[]) {
	const custodianTree = new CustodianTree(
		custodian,
		global,
		threadsLeaf,
		threadsRecurse,
		threadsAcccount,
	);

	const proveStartTimeMs = Date.now();
	const backend = await custodianTree.prove({ zk: true, skipIfExists: false, flushChild: true });
	const proveEndTimeMs = Date.now();
	const proveTimeSec = (proveEndTimeMs - proveStartTimeMs) / 1000;

	const { proof } = await backend.readProof();
	const proofFrLength = proof.length;

	const verifyStartTimeMs = Date.now();
	const result = await backend.verify({ zk: true });
	const verifyEndTimeMs = Date.now();
	const verifyTimeMs = verifyEndTimeMs - verifyStartTimeMs;
	assert(result == true);

	const { proof: proofSol, publicInputs: publicInputsSol } = await backend.getProofForSol();
	const { gas: verifySolGas, result: solResult } = await verifyInSolidity(
		proofSol,
		publicInputsSol,
	);
	assert(solResult == true);

	await backend.flush();

	return { proveTimeSec, proofFrLength, verifyTimeMs, verifySolGas };
}

async function prepareFile() {
	const resultDir = path.resolve(process.cwd(), 'bench', 'result');
	const csvPath = path.join(resultDir, 'e2e.csv');
	await fs.mkdir(resultDir, { recursive: true });

	try {
		await fs.access(csvPath);
	} catch {
		await fs.writeFile(
			csvPath,
			'num,proveTimeSec,proofFrLength,verifyTimeMs,verifySolGas\n',
			'utf8',
		);
	}

	return csvPath;
}

async function main() {
	const { custodian } = await importAccounts(1000);

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

	const numOfAccounts = [1, 10, 50, 100, 1000];
	for (const num of numOfAccounts) {
		logger.info(`==== TESTING ${num} ACCOUNTS ====`);

		const { proveTimeSec, proofFrLength, verifyTimeMs, verifySolGas } = await bench(
			global,
			custodian.slice(0, num),
		);

		const line = `${num},${proveTimeSec},${proofFrLength},${verifyTimeMs},${verifySolGas}`;
		await fs.appendFile(filePath, line + '\n', 'utf8');
		logger.info(`Wrote bench result: ${line}`);
	}
}

main()
	.then(() => {
		logger.info('E2E Bench Complete');
		process.exit(0);
	})
	.catch((err: Error) => {
		logger.error('Failed: ', { error: err.message, stack: err.stack });
		process.exit(1);
	});
