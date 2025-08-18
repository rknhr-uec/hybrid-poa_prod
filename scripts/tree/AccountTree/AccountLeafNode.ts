import { deriveKeys, Fr, MerkleTreeId } from '@aztec/aztec.js';
import { NOTE_HASH_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT } from '@aztec/constants';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import { NoteDao } from '@aztec/pxe/server';
import { computeUniqueNoteHash, deriveStorageSlotInMap, siloNoteHash } from '@aztec/stdlib/hash';
import { computeAppSecretKey, KEY_PREFIXES } from '@aztec/stdlib/keys';
import accountTreeLeafCircuit from '../../../circuits/target/account_tree_leaf.json' with { type: 'json' };
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';
import {
	AccountTreeLeafCircuitInput,
	MAX_NOTE_PER_LEAF,
	MembershipWitness,
	NullifierLeafPreimage,
	UintNoteWithoutOwner,
} from '../../types/AccountTreeLeaf.js';
import { VK_ZERO } from '../../types/share.js';
import { AztecAccount } from '../../utils/account.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';

export class AccountLeafNode extends TreeNode {
	constructor(
		readonly noteDaos: NoteDao[],
		readonly account: AztecAccount,
		readonly global: Global,
	) {
		super();

		if (noteDaos.length > MAX_NOTE_PER_LEAF) {
			throw new Error('noteDaos exceeds MAX_NOTE_PER_LEAF');
		}
		if (noteDaos.length > 1) {
			for (let i = 1; i < noteDaos.length; i++) {
				if (noteDaos[i - 1].index > noteDaos[i].index) {
					throw new Error('Notes must be in ascending order');
				}
			}
		}
	}

	public async prove(opt: ProveOption = DEFAULT_PROVE_OPTION) {
		const notes: UintNoteWithoutOwner[] = [];
		const noteNonces: Fr[] = [];
		const lowNullifierLeafPreimages: NullifierLeafPreimage[] = [];
		const lowNullifierMembershipWitnesses: MembershipWitness[] = [];
		const noteHashMembershipWitnesses: MembershipWitness[] = [];
		let minNoteHashLeafIndex = Fr.ZERO;
		let maxNoteHashLeafIndex = Fr.ZERO;
		let leafSum: bigint = 0n;

		for (let i = 0; i < MAX_NOTE_PER_LEAF; i++) {
			if (i < this.noteDaos.length) {
				const noteDao = this.noteDaos[i];
				const lowNullifierMembershipWitness =
					await this.global.aztecNode.getLowNullifierMembershipWitness(
						this.global.blockNumber,
						noteDao.siloedNullifier,
					);
				if (!lowNullifierMembershipWitness) {
					throw new Error('lowNullifierMembershipWitness undefined');
				}

				const siloteNoteHash = await siloNoteHash(this.global.tokenAddr, noteDao.noteHash);
				const uniqueNoteHash = await computeUniqueNoteHash(noteDao.noteNonce, siloteNoteHash);
				const [noteHashLeafIndex] = await this.global.aztecNode.findLeavesIndexes(
					this.global.blockNumber,
					MerkleTreeId.NOTE_HASH_TREE,
					[uniqueNoteHash],
				);
				if (!noteHashLeafIndex) {
					throw new Error('noteHashLeafIndex undefined');
				}

				const noteHashMembershipWitness = await this.global.aztecNode.getNoteHashSiblingPath(
					this.global.blockNumber,
					noteHashLeafIndex.data,
				);

				notes.push({
					randomness: noteDao.note.items[1],
					value: noteDao.note.items[2].toString(),
				});
				noteNonces.push(noteDao.noteNonce);
				lowNullifierLeafPreimages.push({
					nullifier: lowNullifierMembershipWitness.leafPreimage.leaf.nullifier,
					next_index: lowNullifierMembershipWitness.leafPreimage.nextIndex.toString(),
					next_nullifier: lowNullifierMembershipWitness.leafPreimage.nextKey,
				});
				lowNullifierMembershipWitnesses.push({
					sibling_path: lowNullifierMembershipWitness.siblingPath.toFields(),
					leaf_index: lowNullifierMembershipWitness.index.toString(),
				});
				noteHashMembershipWitnesses.push({
					sibling_path: noteHashMembershipWitness.toFields(),
					leaf_index: noteHashLeafIndex.data.toString(),
				});
				if (minNoteHashLeafIndex.isZero()) {
					minNoteHashLeafIndex = Fr.fromString(noteHashLeafIndex.data.toString());
				}
				maxNoteHashLeafIndex = Fr.fromString(noteHashLeafIndex.data.toString());
				leafSum += BigInt(noteDao.note.items[2].toString());
			} else {
				notes.push({
					randomness: Fr.ZERO,
					value: '0',
				});
				noteNonces.push(Fr.ZERO);
				lowNullifierLeafPreimages.push({
					nullifier: Fr.ZERO,
					next_index: '0',
					next_nullifier: Fr.ZERO,
				});
				lowNullifierMembershipWitnesses.push({
					sibling_path: Array(NULLIFIER_TREE_HEIGHT).fill(Fr.ZERO),
					leaf_index: '0',
				});
				noteHashMembershipWitnesses.push({
					sibling_path: Array(NOTE_HASH_TREE_HEIGHT).fill(Fr.ZERO),
					leaf_index: '0',
				});
			}
		}

		const { masterNullifierSecretKey } = await deriveKeys(this.account.secretKey);
		const nskApp = await computeAppSecretKey(
			masterNullifierSecretKey,
			this.global.tokenAddr,
			KEY_PREFIXES[0],
		);
		const storageSlot = await deriveStorageSlotInMap(
			TokenContract.storage.private_balances.slot,
			this.account.address,
		);

		const circuitInput: AccountTreeLeafCircuitInput = {
			notes: notes,
			note_owner: this.account.address.toField(),
			note_nonces: noteNonces,
			token_address: this.global.tokenAddr.toField(),
			storage_slot: storageSlot,
			nsk_app: nskApp,
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			low_nullifier_leaf_preimages: lowNullifierLeafPreimages,
			low_nullifier_membership_witnesses: lowNullifierMembershipWitnesses,
			note_hash_membership_witnesses: noteHashMembershipWitnesses,
			min_note_hash_leaf_index: minNoteHashLeafIndex,
			max_note_hash_leaf_index: maxNoteHashLeafIndex,
			leaf_sum: leafSum.toString(),
			is_verifying_leaf: true,
			vk_phantom: VK_ZERO,
		};

		const noir = new Noir(accountTreeLeafCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('account_tree_leaf', witness);

		await backend.prove(opt);

		this.backend = backend;

		return backend;
	}
}
