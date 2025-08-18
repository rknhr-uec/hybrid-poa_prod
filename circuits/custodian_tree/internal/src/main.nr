use lib::safecast_to_u128;

mod constants;
use constants::{
    HONK_IDENTIFIER, HONK_PROOF_SIZE, HONK_VK_SIZE, MAX_PROOFS, PUBLIC_INPUTS_NO_VK_SIZE,
    PUBLIC_INPUTS_SIZE, VK_LEAF,
};

pub fn main(
    internal_sum: pub u128,
    token_address: pub Field,
    public_balances_map_storage_slot: pub Field,
    public_data_tree_root: pub Field,
    private_balances_map_storage_slot: pub Field,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    min_account_address: pub Field,
    max_account_address: pub Field,
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
            assert_eq(public_inputs[i][1], token_address, "CTI: token_address mismatch");
            assert_eq(
                public_inputs[i][2],
                public_balances_map_storage_slot,
                "CTI: public_balances_map_storage_slot mismatch",
            );
            assert_eq(
                public_inputs[i][3],
                public_data_tree_root,
                "CTI: public_data_tree_root mismatch",
            );
            assert_eq(
                public_inputs[i][4],
                private_balances_map_storage_slot,
                "CTI: private_balances_map_storage_slot mismatch",
            );
            assert_eq(
                public_inputs[i][5],
                note_hash_tree_root,
                "CTI: note_hash_tree_root mismatch",
            );
            assert_eq(
                public_inputs[i][6],
                nullifier_tree_root,
                "CTI: nullifier_tree_root mismatch",
            );

            if i > 0 {
                // Check i-1 max < i min
                assert(
                    public_inputs[i - 1][8].lt(public_inputs[i][7]),
                    "CTI: Incorrect account ordering",
                )
            }

            if public_inputs[i][9] == 0 {
                // Check if child node is using the correct verification key
                for j in 0..HONK_VK_SIZE {
                    assert_eq(
                        public_inputs[i][PUBLIC_INPUTS_NO_VK_SIZE + j],
                        vk[j],
                        "CTI: verification_key mismatch",
                    );
                }
            }

            computed_internal_sum += safecast_to_u128(public_inputs[i][0]);
            last_index = i;
        }

        std::verify_proof_with_type(vk, proofs[i], public_inputs[i], 0x0, HONK_IDENTIFIER);
    }

    if is_verifying_leaf {
        for j in 0..HONK_VK_SIZE {
            assert_eq(vk[j], VK_LEAF[j], "CTI: vk mismatch with VK_LEAF");
        }
    }

    assert_eq(public_inputs[0][7], min_account_address, "CTI: min_account_address mismatch");
    assert_eq(
        public_inputs[last_index][8],
        max_account_address,
        "CTI: max_account_address mismatch",
    );
    assert_eq(computed_internal_sum, internal_sum, "CTI: internal_sum mismatch");
}
