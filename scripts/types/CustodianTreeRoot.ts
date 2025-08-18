import { Fr } from '@aztec/aztec.js';

export interface CustodianTreeRootInput {
	custodian_balance: string;
	token_address: Fr;
	public_balances_map_storage_slot: Fr;
	public_data_tree_root: Fr;
	private_balances_map_storage_slot: Fr;
	note_hash_tree_root: Fr;
	nullifier_tree_root: Fr;
	vk: Fr[];
	proof: Fr[];
	public_inputs: Fr[];
}
