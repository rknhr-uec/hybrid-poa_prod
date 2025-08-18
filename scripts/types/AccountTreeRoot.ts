import { Fr, Point } from '@aztec/aztec.js';

interface InnerField {
	inner: Fr;
}

interface Scalar {
	lo: Fr;
	hi: Fr;
}

interface MembershipWitness {
	leaf_index: string;
	sibling_path: Fr[];
}

export interface PublicDataTreeLeafPreimage {
	slot: Fr;
	value: Fr;
	next_slot: Fr;
	next_index: string;
}

export interface AccountTreeRootInput {
	account_address: InnerField;
	token_address: InnerField;
	account_total_balance: string;

	public_balances_map_storage_slot: Fr;
	public_data_tree_root: Fr;
	public_data_preimage: PublicDataTreeLeafPreimage;
	public_data_membership_witness: MembershipWitness;

	private_balances_map_storage_slot: Fr;
	nsk_app: Fr;
	nsk_m: Scalar;
	ivpk_m: ReturnType<Point['toWrappedNoirStruct']>;
	ovpk_m: ReturnType<Point['toWrappedNoirStruct']>;
	tpk_m: ReturnType<Point['toWrappedNoirStruct']>;
	owner_partial_address: InnerField;
	note_hash_tree_root: Fr;
	nullifier_tree_root: Fr;
  vk: Fr[];
	proof: Fr[];
	public_inputs: Fr[];
}
