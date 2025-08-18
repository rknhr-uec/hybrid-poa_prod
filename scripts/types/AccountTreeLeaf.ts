import { Fr } from '@aztec/aztec.js';

export const MAX_NOTE_PER_LEAF = 32;

export interface NullifierLeafPreimage {
	nullifier: Fr;
	next_nullifier: Fr;
	next_index: string;
}

export interface UintNoteWithoutOwner {
	randomness: Fr;
	value: string;
}

export interface MembershipWitness {
	leaf_index: string;
	sibling_path: Fr[];
}

export interface AccountTreeLeafCircuitInput {
	notes: UintNoteWithoutOwner[];
	note_owner: Fr;
	note_nonces: Fr[];
	token_address: Fr;
	storage_slot: Fr;
	nsk_app: Fr;
	note_hash_tree_root: Fr;
	nullifier_tree_root: Fr;
	low_nullifier_leaf_preimages: NullifierLeafPreimage[];
	low_nullifier_membership_witnesses: MembershipWitness[];
	note_hash_membership_witnesses: MembershipWitness[];
	min_note_hash_leaf_index: Fr;
	max_note_hash_leaf_index: Fr;
	leaf_sum: string;
  is_verifying_leaf: boolean,
  vk_phantom: Fr[];
}
