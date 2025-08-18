import { NoteDataProvider } from '@aztec/pxe/server';
import { NotesFilter } from '@aztec/stdlib/note';
import { assert, describe, expect, test } from 'vitest';
import { AccountInternalNode, AccountLeafNode } from '../scripts/tree/AccountTree/index.js';
import { Global } from '../scripts/tree/share/Global.js';
import { TreeNode } from '../scripts/tree/share/TreeNode.js';
import { MAX_NOTE_PER_LEAF } from '../scripts/types/AccountTreeLeaf.js';
import { MAX_PROOFS } from '../scripts/types/share.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';

describe('account_tree_internal', () => {
	test('One layer', async () => {
		const threads = 4;
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
			(noteDaos) => new AccountLeafNode(noteDaos, custodian[0], global),
		);

		for (let i = 0; i < leafNodes.length; i += threads) {
			const batch = leafNodes.slice(i, i + threads);
			await Promise.all(batch.map((node) => node.prove()));
		}

		const groupedNodes = Array.from({ length: Math.ceil(leafNodes.length / MAX_PROOFS) }, (_, i) =>
			leafNodes.slice(i * MAX_PROOFS, (i + 1) * MAX_PROOFS),
		);
		const internalNodes = groupedNodes.map(
			(nodes) => new AccountInternalNode(nodes, true, custodian[0], global),
		);

		for (let i = 0; i < internalNodes.length; i += threadsRecurse) {
			const batch = internalNodes.slice(i, i + threadsRecurse);
			await Promise.all(batch.map((node) => node.prove({ recursive: false })));
		}

		for (let i = 0; i < internalNodes.length; i++) {
			const backend = internalNodes[i].getBackend();
			const result = await backend.verify();
			expect(result).to.be.true;
			await backend.flush();
		}
	});

	test('Multiple layers', async () => {
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
			(noteDaos) => new AccountLeafNode(noteDaos, custodian[0], global),
		);

		for (let i = 0; i < leafNodes.length; i += threadsLeaf) {
			const batch = leafNodes.slice(i, i + threadsLeaf);
			await Promise.all(batch.map((node) => node.prove()));
		}

		const aggreate = async (nodes: TreeNode[], isLeafNode: boolean): Promise<TreeNode> => {
			if (nodes.length == 1) {
				return nodes[0];
			}

			const groupedNodes = Array.from({ length: Math.ceil(nodes.length / MAX_PROOFS) }, (_, i) =>
				nodes.slice(i * MAX_PROOFS, (i + 1) * MAX_PROOFS),
			);
			const internalNodes = groupedNodes.map(
				(nodes) => new AccountInternalNode(nodes, isLeafNode, custodian[0], global),
			);
			for (let i = 0; i < internalNodes.length; i += threadsRecurse) {
				const batch = internalNodes.slice(i, i + threadsRecurse);
				await Promise.all(
					batch.map((node) =>
						node.prove({
							recursive: internalNodes.length != 1,
						}),
					),
				);
			}
			return aggreate(internalNodes, false);
		};

		const internalNode = await aggreate(leafNodes, true);
		const backend = internalNode.getBackend();
		const result = await backend.verify();

		expect(result).to.be.true;
		await backend.flush();
	});
});
