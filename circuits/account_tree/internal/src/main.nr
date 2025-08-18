use lib::safecast_to_u128;

mod constants;
use constants::{
    HONK_IDENTIFIER, HONK_PROOF_SIZE, HONK_VK_SIZE, MAX_PROOFS, PUBLIC_INPUTS_NO_VK_SIZE,
    PUBLIC_INPUTS_SIZE, VK_LEAF,
};

fn main(
    note_owner: pub Field,
    token_address: pub Field,
    storage_slot: pub Field,
    nsk_app: pub Field,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    min_note_hash_leaf_index: pub Field,
    max_note_hash_leaf_index: pub Field,
    internal_sum: pub u128,
    is_verifying_leaf: pub bool,
    vk: pub [Field; HONK_VK_SIZE],
    proofs: [[Field; HONK_PROOF_SIZE]; MAX_PROOFS],
    public_inputs: [[Field; PUBLIC_INPUTS_SIZE]; MAX_PROOFS],
    child_proof_size: u32,
) {
    let mut last_index = 0;
    let mut computed_internal_sum = 0;

    for i in 0..MAX_PROOFS {
        if i < child_proof_size {
            assert_eq(public_inputs[i][0], note_owner, "ATI: note_owner mismatch");
            assert_eq(public_inputs[i][1], token_address, "ATI: token_address mismatch");
            assert_eq(public_inputs[i][2], storage_slot, "ATI: storage_slot mismatch");
            assert_eq(public_inputs[i][3], nsk_app, "ATI: nsk_app mismatch with public inputs");
            assert_eq(
                public_inputs[i][4],
                note_hash_tree_root,
                "ATI: note_hash_tree_root mismatch",
            );
            assert_eq(
                public_inputs[i][5],
                nullifier_tree_root,
                "ATI: nullifier_tree_root mismatch",
            );

            if i > 0 {
                // Check i-1 max < i min
                assert(
                    public_inputs[i - 1][6] as u64 < public_inputs[i][7] as u64,
                    "ATI: Incorrect note ordering",
                );
            }

            // If child node is NOT verifying leaf node, check that the child node vk is using correct vk
            if public_inputs[i][9] == 0 {
                for j in 0..HONK_VK_SIZE {
                    assert_eq(
                        public_inputs[i][PUBLIC_INPUTS_NO_VK_SIZE + j],
                        vk[j],
                        "ATI: vk mismatch with public_inputs",
                    );
                }
            }

            computed_internal_sum += safecast_to_u128(public_inputs[i][8]);
            last_index = i;
        }

        // Unfortunately, verify_proof does not support branching
        // So, if the actual child proof size is less than MAX_PROOF,
        // we set proofs[i] = proofs[0], public_inputs[i] = public_inputs[0] for i > proof size
        std::verify_proof_with_type(vk, proofs[i], public_inputs[i], 0x0, HONK_IDENTIFIER);
    }

    if is_verifying_leaf {
        for j in 0..HONK_VK_SIZE {
            assert_eq(vk[j], VK_LEAF[j], "ATI: vk mismatch with VK_LEAF");
        }
    }

    assert_eq(public_inputs[0][6], min_note_hash_leaf_index, "ATI: min_note_hash_index mismatch");
    assert_eq(
        public_inputs[last_index][7],
        max_note_hash_leaf_index,
        "ATI: max_note_hash_index mismatch",
    );
    assert_eq(computed_internal_sum, internal_sum, "ATI: internal_sum mismatch");
}
