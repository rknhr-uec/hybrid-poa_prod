import { NoteDataProvider } from '@aztec/pxe/server';
import { NotesFilter } from '@aztec/stdlib/note';
import { assert, describe, expect, test } from 'vitest';
import { AccountLeafNode } from '../scripts/tree/AccountTree/AccountLeafNode.js';
import { MAX_NOTE_PER_LEAF } from '../scripts/types/AccountTreeLeaf.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';

describe('account_tree_leaf', () => {
	test('One proof', async () => {
		const { custodian } = await importAccounts(1);
		const tokenAddr = await getTokenAddress();

		const notesFilter: NotesFilter = {
			contractAddress: tokenAddr,
			recipient: custodian[0].address,
		};
		const noteDataProvider = await NoteDataProvider.create(custodian[0].store);
		const noteDaos = await noteDataProvider.getNotes(notesFilter);
		expect(noteDaos.length).gte(1);

		const sortedNoteDaos = noteDaos
			.sort((a, b) => (a.index > b.index ? 1 : -1))
			.slice(0, MAX_NOTE_PER_LEAF);

		const blockNumber = await aztecNode.getBlockNumber();
		const blockHeader = await aztecNode.getBlockHeader(blockNumber);
		assert.ok(blockHeader, 'blockHeader undefined');

		const leafNode = new AccountLeafNode(sortedNoteDaos, custodian[0], {
			blockHeader,
			blockNumber,
			aztecNode: aztecNode,
			tokenAddr,
		});

		const backend = await leafNode.prove({ recursive: false });
		const result = await backend.verify();
		expect(result).to.be.true;
		await backend.flush();
	});

	test('Multiple proofs in parallel', async () => {
		const threads = 4;

		const { custodian } = await importAccounts(1);
		const tokenAddr = await getTokenAddress();

		const blockNumber = await aztecNode.getBlockNumber();
		const blockHeader = await aztecNode.getBlockHeader(blockNumber);
		assert.ok(blockHeader, 'blockHeader undefined');

		const notesFilter: NotesFilter = {
			contractAddress: tokenAddr,
			recipient: custodian[0].address,
		};
		const noteDataProvider = await NoteDataProvider.create(custodian[0].store);
		const noteDaos = await noteDataProvider.getNotes(notesFilter);
		const sortedNoteDaos = noteDaos.sort((a, b) => (a.index > b.index ? 1 : -1));
		const groupedNoteDaos = Array.from(
			{ length: Math.ceil(sortedNoteDaos.length / MAX_NOTE_PER_LEAF) },
			(_, i) => sortedNoteDaos.slice(i * MAX_NOTE_PER_LEAF, (i + 1) * MAX_NOTE_PER_LEAF),
		);
		const leafNodes = groupedNoteDaos.map(
			(noteDaos) =>
				new AccountLeafNode(noteDaos, custodian[0], {
					blockHeader,
					blockNumber,
					aztecNode: aztecNode,
					tokenAddr,
				}),
		);

		for (let i = 0; i < leafNodes.length; i += threads) {
			const batch = leafNodes.slice(i, i + threads);
			const backends = await Promise.all(batch.map((node) => node.prove({ recursive: false })));
			const results = await Promise.all(backends.map((backend) => backend.verify()));

			results.map((result) => expect(result).to.be.true);
			await Promise.all(backends.map((backend) => backend.flush()));
		}
	});
});
