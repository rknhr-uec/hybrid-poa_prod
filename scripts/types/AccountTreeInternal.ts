import { Fr } from '@aztec/aztec.js';
import { HONK_VK_SIZE } from './share.js';

const PUBLIC_INPUTS_NO_VK_SIZE = 10;
const PUBLIC_INPUTS_SIZE = PUBLIC_INPUTS_NO_VK_SIZE + HONK_VK_SIZE;
export const PUBLIC_INPUTS_ZERO_INTERNAL: Fr[] = Array(PUBLIC_INPUTS_SIZE).fill(Fr.ZERO);

export interface AccountTreeInternalCircuitInput {
	note_owner: Fr;
	token_address: Fr;
	storage_slot: Fr;
	nsk_app: Fr;
	note_hash_tree_root: Fr;
	nullifier_tree_root: Fr;
	min_note_hash_leaf_index: Fr;
	max_note_hash_leaf_index: Fr;
	internal_sum: string;
	is_verifying_leaf: boolean;
	vk: Fr[];
	proofs: Fr[][];
	public_inputs: Fr[][];
  child_proof_size: string;
}
