import { NoteDataProvider } from '@aztec/pxe/server';
import { NotesFilter } from '@aztec/stdlib/note';
import { MAX_NOTE_PER_LEAF } from '../../types/AccountTreeLeaf.js';
import { AztecAccount } from '../../utils/account.js';
import { logger as baseLogger } from '../../utils/logger.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';
import { AccountInternalNode } from './AccountInternalNode.js';
import { AccountLeafNode } from './AccountLeafNode.js';
import { AccountRootNode } from './AccountRootNode.js';
import { MAX_PROOFS } from '../../types/share.js';
import { Logger } from 'winston';

export class AccountTree extends TreeNode {
	private logger: Logger;

	constructor(
		readonly account: AztecAccount,
		readonly global: Global,
		readonly threadsLeaf: number,
		readonly threadsRecurse: number,
	) {
		super();

		if (threadsLeaf < 1 || threadsRecurse < 1) {
			throw new Error('Invalid thread');
		}

		const shortAddr = account.address.toString().slice(0, 8);
		this.logger = baseLogger.child({ module: `AccountTree | ${shortAddr}` });
	}

	public async prove(opt: ProveOption = DEFAULT_PROVE_OPTION, maxNotes?: number) {
		const leafNodes = await this.buildLeafNodes(maxNotes);
		const totalLeaves = leafNodes.length;
		this.logger.info(`Start proving ${totalLeaves} account leaf nodes`);
		for (let i = 0; i < leafNodes.length; i += this.threadsLeaf) {
			const batch = leafNodes.slice(i, i + this.threadsLeaf);
			this.logger.info(`Working on batch ${i}-${i + batch.length - 1}`);

			await Promise.all(batch.map((node) => node.prove({ ...opt, recursive: true, zk: false })));
			this.logger.info(`Built ${i + batch.length - 1 + 1}/${totalLeaves} account leaf nodes`);
		}

		this.logger.info(`Now aggregating ${leafNodes.length} account leaf nodes to 1 node`);
		const lastInternalNode = await this.aggreate(leafNodes, true, opt, 1);
		const rootNode = new AccountRootNode(lastInternalNode, this.account, this.global);

		this.logger.info('Proving account root');
		await rootNode.prove(opt);

		this.backend = rootNode.getBackend();
		this.logger.info('Done: account tree proven');

		return this.backend;
	}

	private async aggreate(
		nodes: TreeNode[],
		isLeafNode: boolean,
		opt: ProveOption,
		level = 0,
	): Promise<TreeNode> {
		if (nodes.length == 1 && !isLeafNode) {
			return nodes[0];
		}

		const internalNodes = this.buildInternalNodes(nodes, isLeafNode);
		const total = internalNodes.length;
		this.logger.info(`Agg lvl ${level}: proving ${total} account internal nodes`);

		for (let i = 0; i < internalNodes.length; i += this.threadsRecurse) {
			const batch = internalNodes.slice(i, i + this.threadsRecurse);
			await Promise.all(batch.map((node) => node.prove({ ...opt, recursive: true, zk: false })));
		}
		return this.aggreate(internalNodes, false, opt, level + 1);
	}

	private async buildLeafNodes(maxNotes?: number) {
		const notesFilter: NotesFilter = {
			contractAddress: this.global.tokenAddr,
			recipient: this.account.address,
		};
		const noteDataProvider = await NoteDataProvider.create(this.account.store);
		const noteDaos = await noteDataProvider.getNotes(notesFilter);
		let sortedNoteDaos = noteDaos.sort((a, b) => (a.index > b.index ? 1 : -1));
		if (maxNotes) {
			sortedNoteDaos = sortedNoteDaos.slice(0, maxNotes);
		}
		const groupedNoteDaos = Array.from(
			{ length: Math.ceil(sortedNoteDaos.length / MAX_NOTE_PER_LEAF) },
			(_, i) => sortedNoteDaos.slice(i * MAX_NOTE_PER_LEAF, (i + 1) * MAX_NOTE_PER_LEAF),
		);
		const leafNodes = groupedNoteDaos.map(
			(noteDaos) => new AccountLeafNode(noteDaos, this.account, this.global),
		);
		return leafNodes;
	}

	private buildInternalNodes(nodes: TreeNode[], isLeafNode: boolean) {
		const groupedNodes = Array.from({ length: Math.ceil(nodes.length / MAX_PROOFS) }, (_, i) =>
			nodes.slice(i * MAX_PROOFS, (i + 1) * MAX_PROOFS),
		);
		const internalNodes = groupedNodes.map(
			(nodes) => new AccountInternalNode(nodes, isLeafNode, this.account, this.global),
		);
		return internalNodes;
	}
}

export { AccountInternalNode, AccountLeafNode, AccountRootNode };
