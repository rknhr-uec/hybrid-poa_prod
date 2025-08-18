use lib::safecast_to_u128;

mod constants;
use constants::{
    HONK_IDENTIFIER, HONK_PROOF_SIZE, HONK_VK_SIZE, MAX_PROOFS, PUBLIC_INPUTS_SIZE,
    VK_ACCOUNT_TREE_ROOT,
};

pub fn main(
    leaf_sum: pub u128,
    token_address: pub Field,
    public_balances_map_storage_slot: pub Field,
    public_data_tree_root: pub Field,
    private_balances_map_storage_slot: pub Field,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    min_account_address: pub Field,
    max_account_address: pub Field,
    is_verifying_leaf: pub bool, // Required for recursive circuit
    vk: pub [Field; HONK_VK_SIZE],
    proofs: [[Field; HONK_PROOF_SIZE]; MAX_PROOFS],
    public_inputs: [[Field; PUBLIC_INPUTS_SIZE]; MAX_PROOFS],
    child_proof_size: u32,
) {
    let mut last_index = 0;
    let mut computed_leaf_sum = 0;

    for i in 0..MAX_PROOFS {
        if i < child_proof_size {
            assert_eq(public_inputs[i][1], token_address, "CTL: token_address mismatch");
            assert_eq(
                public_inputs[i][3],
                public_balances_map_storage_slot,
                "CTL: public_balances_map_storage_slot mismatch",
            );
            assert_eq(
                public_inputs[i][4],
                public_data_tree_root,
                "CTL: public_data_tree_root mismatch",
            );
            assert_eq(
                public_inputs[i][5],
                private_balances_map_storage_slot,
                "CTL: private_balances_map_storage_slot mismatch",
            );
            assert_eq(
                public_inputs[i][6],
                note_hash_tree_root,
                "CTL: note_hash_tree_root mismatch",
            );
            assert_eq(
                public_inputs[i][7],
                nullifier_tree_root,
                "CTL: nullifier_tree_root mismatch",
            );

            if i > 0 {
                assert(
                    public_inputs[i - 1][0].lt(public_inputs[i][0]),
                    "CTL: Incorrect account ordering",
                )
            }

            computed_leaf_sum += safecast_to_u128(public_inputs[i][2]);
            last_index = i;
        }

        std::verify_proof_with_type(vk, proofs[i], public_inputs[i], 0x0, HONK_IDENTIFIER);
    }

    for j in 0..HONK_VK_SIZE {
        assert_eq(vk[j], VK_ACCOUNT_TREE_ROOT[j], "CTL: vk_account_tree_root mismatch with vk");
    }

    assert_eq(public_inputs[0][0], min_account_address, "CTL: min_account_address mismatch");
    assert_eq(
        public_inputs[last_index][0],
        max_account_address,
        "CTL: max_account_address mismatch",
    );
    assert_eq(is_verifying_leaf, true, "CTL: Invalid is_verifing_leaf");
    assert_eq(computed_leaf_sum, leaf_sum, "CTL: leaf_sum mismatch");
}
