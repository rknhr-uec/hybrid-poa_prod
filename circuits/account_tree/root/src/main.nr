use aztec::{
    prelude::AztecAddress,
    protocol_types::{
        address::PartialAddress,
        constants::PUBLIC_DATA_TREE_HEIGHT,
        data::public_data_tree_leaf_preimage::PublicDataTreeLeafPreimage,
        merkle_tree::membership::MembershipWitness,
        public_keys::{IvpkM, OvpkM, TpkM},
        scalar::Scalar,
        storage::map::derive_storage_slot_in_map,
        traits::ToField,
    },
};
use lib::safecast_to_u128;

mod account_ownership;
mod public_storage_inclusion;
mod constants;

use constants::{
    HONK_IDENTIFIER, HONK_PROOF_SIZE, HONK_VK_SIZE, PUBLIC_INPUTS_NO_VK_SIZE, PUBLIC_INPUTS_SIZE,
    VK_INTERNAL,
};

fn main(
    account_address: pub AztecAddress,
    token_address: pub AztecAddress,
    account_total_balance: pub u128,
    // Public balance check
    public_balances_map_storage_slot: pub Field,
    public_data_tree_root: pub Field,
    public_data_preimage: PublicDataTreeLeafPreimage,
    public_data_membership_witness: MembershipWitness<PUBLIC_DATA_TREE_HEIGHT>,
    // Private balance check
    private_balances_map_storage_slot: pub Field,
    nsk_app: Field,
    nsk_m: Scalar,
    ivpk_m: IvpkM,
    ovpk_m: OvpkM,
    tpk_m: TpkM,
    owner_partial_address: PartialAddress,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    vk: [Field; HONK_VK_SIZE],
    proof: [Field; HONK_PROOF_SIZE],
    public_inputs: [Field; PUBLIC_INPUTS_SIZE],
) {
    // Public balance check
    {
        if (public_data_preimage.value != 0) {
            let public_balance_storage_slot =
                derive_storage_slot_in_map(public_balances_map_storage_slot, account_address);

            public_storage_inclusion::assert_public_storage_inclusion(
                public_balance_storage_slot,
                token_address,
                public_data_tree_root,
                public_data_preimage,
                public_data_membership_witness,
            );
        }
    }

    // Private balance check
    {
        let private_balance_storage_slot =
            derive_storage_slot_in_map(private_balances_map_storage_slot, account_address);

        assert_eq(public_inputs[0], account_address.to_field(), "ATR: account_address mismatch");
        assert_eq(public_inputs[1], token_address.to_field(), "ATR: token_address mismatch");
        assert_eq(
            public_inputs[2],
            private_balance_storage_slot,
            "ATR: private_balance_storage_slot mismatch",
        );
        assert_eq(public_inputs[3], nsk_app, "ATR: nsk_app mismatch");
        assert_eq(public_inputs[4], note_hash_tree_root, "ATR: note_hash_tree_root mismatch");
        assert_eq(public_inputs[5], nullifier_tree_root, "ATR: nullifier_tree_root mismatch");

        // Must be placed here due to a bug with bb
        std::verify_proof_with_type(vk, proof, public_inputs, 0x0, HONK_IDENTIFIER);

        // If internal node was verifying another internal node
        if public_inputs[9] == 0 {
            for j in 0..HONK_VK_SIZE {
                assert_eq(
                    public_inputs[PUBLIC_INPUTS_NO_VK_SIZE + j],
                    VK_INTERNAL[j],
                    "ATR: vk_internal mismatch with public_inputs",
                );
            }
        }

        for j in 0..HONK_VK_SIZE {
            // vk has to be part be circuit input
            assert_eq(vk[j], VK_INTERNAL[j], "ATR: vk_internal mismatch with vk");
        }

        account_ownership::assert_nsk_app(
            nsk_app,
            nsk_m,
            ivpk_m,
            ovpk_m,
            tpk_m,
            account_address,
            owner_partial_address,
            token_address,
        );
    }

    assert_eq(
        safecast_to_u128(public_data_preimage.value) + safecast_to_u128(public_inputs[8]),
        account_total_balance,
        "ATR: account_total_balance mismatch",
    );
}
