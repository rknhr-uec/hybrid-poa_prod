import { Fr } from '@aztec/aztec.js';

export interface CustodianTreeInternalInput {
	internal_sum: string;
	token_address: Fr;
	public_balances_map_storage_slot: Fr;
	public_data_tree_root: Fr;
	private_balances_map_storage_slot: Fr;
	note_hash_tree_root: Fr;
	nullifier_tree_root: Fr;
	min_account_address: Fr;
	max_account_address: Fr;
	is_verifying_leaf: boolean;
	vk: Fr[];
	proofs: Fr[][];
	public_inputs: Fr[][];
	child_proof_size: string;
}
