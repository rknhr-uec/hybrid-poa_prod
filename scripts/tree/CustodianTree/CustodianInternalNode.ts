import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';
import custodianTreeInternalVk from '../../../circuits/target/custodian_tree_internal_vk_fields.json' with { type: 'json' };
import custodianTreeLeafVk from '../../../circuits/target/custodian_tree_leaf_vk_fields.json' with { type: 'json' };
import custodianTreeInternalCircuit from '../../../circuits/target/custodian_tree_internal.json' with { type: 'json' };
import { Fr } from '@aztec/aztec.js';
import { CustodianTreeInternalInput } from '../../types/CustodianTreeInternal.js';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import { MAX_PROOFS } from '../../types/share.js';
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';

export class CustodianInternalNode extends TreeNode {
	constructor(
		readonly childrenNodes: TreeNode[],
		readonly isVerifyingLeaf: boolean,
		readonly global: Global,
	) {
		super();

		for (const childNode of childrenNodes) {
			if (!childNode.hasProven()) {
				throw new Error('AccountTree not proven yet');
			}
		}
	}

	async prove(opt: ProveOption = DEFAULT_PROVE_OPTION): Promise<NativeUltraHonkBackend> {
		const childrenBackends = this.childrenNodes.map((accounTree) => accounTree.getBackend());
		const childrenProofs = await Promise.all(
			childrenBackends.map((backend) => backend.readProof()),
		);
		const internalSum = childrenProofs.reduce((acc, { publicInputs }) => {
			return acc + BigInt(publicInputs[0].toString());
		}, 0n);
		const minAccAddr = childrenProofs[0].publicInputs[7];
		const maxAccAddr = childrenProofs[childrenProofs.length - 1].publicInputs[8];
		const vk = (this.isVerifyingLeaf ? custodianTreeLeafVk : custodianTreeInternalVk).map((i) =>
			Fr.fromString(i),
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

		const circuitInput: CustodianTreeInternalInput = {
			internal_sum: internalSum.toString(),
			token_address: this.global.tokenAddr.toField(),
			public_balances_map_storage_slot: TokenContract.storage.public_balances.slot,
			public_data_tree_root: this.global.blockHeader.state.partial.publicDataTree.root,
			private_balances_map_storage_slot: TokenContract.storage.private_balances.slot,
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			min_account_address: minAccAddr,
			max_account_address: maxAccAddr,
			is_verifying_leaf: this.isVerifyingLeaf,
			vk,
			proofs,
			public_inputs: publicInputs,
			child_proof_size: this.childrenNodes.length.toString(),
		};

		const noir = new Noir(custodianTreeInternalCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('custodian_tree_internal', witness);

		await backend.prove(opt);

		if (opt.flushChild) {
			await Promise.all(childrenBackends.map((backend) => backend.flush()));
		}

		this.backend = backend;

		return backend;
	}
}
