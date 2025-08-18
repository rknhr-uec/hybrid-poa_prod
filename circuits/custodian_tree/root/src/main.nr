use lib::safecast_to_u128;

mod constants;
use constants::{
    HONK_IDENTIFIER, HONK_PROOF_SIZE, HONK_VK_SIZE, PUBLIC_INPUTS_NO_VK_SIZE, PUBLIC_INPUTS_SIZE,
    VK_INTERNAL,
};

pub fn main(
    custodian_balance: pub u128,
    token_address: pub Field,
    public_balances_map_storage_slot: pub Field,
    public_data_tree_root: pub Field,
    private_balances_map_storage_slot: pub Field,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    vk: [Field; HONK_VK_SIZE],
    proof: [Field; HONK_PROOF_SIZE],
    public_inputs: [Field; PUBLIC_INPUTS_SIZE],
) {
    assert_eq(public_inputs[1], token_address, "CTR: token_address mismatch");
    assert_eq(
        public_inputs[2],
        public_balances_map_storage_slot,
        "CTR: public_balances_map_storage_slot mismatch",
    );
    assert_eq(public_inputs[3], public_data_tree_root, "CTR: public_data_tree_root mismatch");
    assert_eq(
        public_inputs[4],
        private_balances_map_storage_slot,
        "CTR: private_balances_map_storage_slot mismatch",
    );
    assert_eq(public_inputs[5], note_hash_tree_root, "CTR: note_hash_tree_root mismatch");
    assert_eq(public_inputs[6], nullifier_tree_root, "CTR: nullifier_tree_root mismatch");
    assert_eq(
        safecast_to_u128(public_inputs[0]),
        custodian_balance,
        "CTR: custodian_balance mismatch",
    );

    std::verify_proof_with_type(vk, proof, public_inputs, 0x0, HONK_IDENTIFIER);

    if (public_inputs[9] == 0) {
        for j in 0..HONK_VK_SIZE {
            assert_eq(
                public_inputs[PUBLIC_INPUTS_NO_VK_SIZE + j],
                VK_INTERNAL[j],
                "CTR: vk_internal mismatch with public_inputs",
            );
        }
    }

    for j in 0..HONK_VK_SIZE {
        assert_eq(vk[j], VK_INTERNAL[j], "CTR: vk_internal mismatch with vk");
    }
}
