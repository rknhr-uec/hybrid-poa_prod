import { Fr } from '@aztec/aztec.js';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import accountTreeRootVk from '../../../circuits/target/account_tree_root_vk_fields.json' with { type: 'json' };
import custodianTreeLeafCircuit from '../../../circuits/target/custodian_tree_leaf.json' with { type: 'json' };
import { CustodianTreeLeafInput } from '../../types/CustodianTreeLeaf.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { AccountTree } from '../AccountTree/index.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';
import { MAX_PROOFS } from '../../types/share.js';
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';

export class CustodianLeafNode extends TreeNode {
	constructor(
		readonly accountTrees: AccountTree[],
		readonly global: Global,
	) {
		super();

		for (const accounTree of accountTrees) {
			if (!accounTree.hasProven()) {
				throw new Error('AccountTree not proven yet');
			}
		}

		// Add ordering check
	}

	async prove(opt: ProveOption = DEFAULT_PROVE_OPTION) {
		const childrenBackends = this.accountTrees.map((accounTree) => accounTree.getBackend());
		const childrenProofs = await Promise.all(
			childrenBackends.map((backend) => backend.readProof()),
		);
		const leafSum = childrenProofs.reduce((acc, { publicInputs }) => {
			return acc + BigInt(publicInputs[2].toString());
		}, 0n);
		const minAccAddr = childrenProofs[0].publicInputs[0];
		const maxAccAddr = childrenProofs[childrenProofs.length - 1].publicInputs[0];
		const vk = accountTreeRootVk.map((i) => Fr.fromString(i));
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

		const circuitInput: CustodianTreeLeafInput = {
			leaf_sum: leafSum.toString(),
			token_address: this.global.tokenAddr.toField(),
			public_balances_map_storage_slot: TokenContract.storage.public_balances.slot,
			public_data_tree_root: this.global.blockHeader.state.partial.publicDataTree.root,
			private_balances_map_storage_slot: TokenContract.storage.private_balances.slot,
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			min_account_address: minAccAddr,
			max_account_address: maxAccAddr,
			is_verifying_leaf: true,
			vk,
			proofs,
			public_inputs: publicInputs,
			child_proof_size: this.accountTrees.length.toString(),
		};

		const noir = new Noir(custodianTreeLeafCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('custodian_tree_leaf', witness);

		await backend.prove(opt);

		if (opt.flushChild) {
			await Promise.all(childrenBackends.map((backend) => backend.flush()));
		}

		this.backend = backend;

		return backend;
	}
}
