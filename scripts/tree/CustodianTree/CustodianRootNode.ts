import { Fr } from '@aztec/aztec.js';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import custodianTreeInternalVk from '../../../circuits/target/custodian_tree_internal_vk_fields.json' with { type: 'json' };
import custodianTreeRootCircuit from '../../../circuits/target/custodian_tree_root.json' with { type: 'json' };
import { CustodianTreeRootInput } from '../../types/CustodianTreeRoot.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';

export class CustodianRootNode extends TreeNode {
	constructor(
		readonly childNode: TreeNode,
		readonly global: Global,
	) {
		super();

		if (!childNode.hasProven()) {
			throw new Error('AccountTree not proven yet');
		}
	}

	async prove(opt: ProveOption = DEFAULT_PROVE_OPTION): Promise<NativeUltraHonkBackend> {
		const childBackend = this.childNode.getBackend();
		const childProof = await childBackend.readProof();
		const vk = custodianTreeInternalVk.map((i) => Fr.fromString(i));

		const circuitInput: CustodianTreeRootInput = {
			custodian_balance: childProof.publicInputs[0].toString(),
			token_address: this.global.tokenAddr.toField(),
			public_balances_map_storage_slot: TokenContract.storage.public_balances.slot,
			public_data_tree_root: this.global.blockHeader.state.partial.publicDataTree.root,
			private_balances_map_storage_slot: TokenContract.storage.private_balances.slot,
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			vk,
			proof: childProof.proof,
			public_inputs: childProof.publicInputs,
		};

		const noir = new Noir(custodianTreeRootCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('custodian_tree_root', witness);

		await backend.prove(opt);

		if (opt.flushChild) {
			await childBackend.flush();
		}

		this.backend = backend;

		return backend;
	}
}
