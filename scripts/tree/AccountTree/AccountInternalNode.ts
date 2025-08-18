import { deriveKeys, Fr } from '@aztec/aztec.js';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import { deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import { computeAppSecretKey, KEY_PREFIXES } from '@aztec/stdlib/keys';
import accountTreeInternalCircuit from '../../../circuits/target/account_tree_internal.json' with { type: 'json' };
import accountTreeInternalVk from '../../../circuits/target/account_tree_internal_vk_fields.json' with { type: 'json' };
import accountTreeLeafVk from '../../../circuits/target/account_tree_leaf_vk_fields.json' with { type: 'json' };
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';
import { AccountTreeInternalCircuitInput } from '../../types/AccountTreeInternal.js';
import { MAX_PROOFS } from '../../types/share.js';
import { AztecAccount } from '../../utils/account.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';

export class AccountInternalNode extends TreeNode {
	public childrenBackends: NativeUltraHonkBackend[] = [];

	constructor(
		readonly childrenNodes: TreeNode[],
		readonly isVerifyingLeaf: boolean,
		readonly account: AztecAccount,
		readonly global: Global,
	) {
		super();

		if (childrenNodes.length > MAX_PROOFS) {
			throw new Error('childNodes exceeds MAX_PROOFS');
		}
		for (const childNode of childrenNodes) {
			if (!childNode.hasProven()) {
				throw new Error('Child node has not proven yet');
			}
			this.childrenBackends.push(childNode.getBackend());
		}

		// Add ordering check
	}

	async prove(opt: ProveOption = DEFAULT_PROVE_OPTION) {
		const childrenProofs = await Promise.all(
			this.childrenBackends.map((backend) => backend.readProof()),
		);

		const internalSum = childrenProofs.reduce((acc, { publicInputs }) => {
			return acc + BigInt(publicInputs[8].toString());
		}, 0n);
		const minNoteHashLeafIndex = childrenProofs[0].publicInputs[6];
		const maxNoteHashLeafIndex = childrenProofs[childrenProofs.length - 1].publicInputs[7];
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

		const proofs = Array(MAX_PROOFS)
			.fill([])
			.map((_, i) =>
				i < childrenProofs.length ? childrenProofs[i].proof : childrenProofs[0].proof,
			);
		const publicInputs = Array(MAX_PROOFS)
			.fill([])
			.map((_, i) =>
				i < childrenProofs.length ? childrenProofs[i].publicInputs : childrenProofs[0].publicInputs,
			);
		const vk = (this.isVerifyingLeaf ? accountTreeLeafVk : accountTreeInternalVk).map((i) =>
			Fr.fromString(i),
		);

		const circuitInput: AccountTreeInternalCircuitInput = {
			note_owner: this.account.address.toField(),
			token_address: this.global.tokenAddr.toField(),
			storage_slot: storageSlot,
			nsk_app: nskApp,
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			min_note_hash_leaf_index: minNoteHashLeafIndex,
			max_note_hash_leaf_index: maxNoteHashLeafIndex,
			internal_sum: internalSum.toString(),
			is_verifying_leaf: this.isVerifyingLeaf,
			vk,
			proofs,
			public_inputs: publicInputs,
			child_proof_size: childrenProofs.length.toString(),
		};

		const noir = new Noir(accountTreeInternalCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('account_tree_internal', witness);

		await backend.prove(opt);

		if (opt.flushChild) {
			await Promise.all(this.childrenBackends.map((backend) => backend.flush()));
		}

		this.backend = backend;

		return backend;
	}
}
