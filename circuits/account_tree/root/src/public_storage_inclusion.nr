use aztec::{
    prelude::AztecAddress,
    protocol_types::{
        constants::{GENERATOR_INDEX__PUBLIC_LEAF_INDEX, PUBLIC_DATA_TREE_HEIGHT},
        data::public_data_tree_leaf_preimage::PublicDataTreeLeafPreimage,
        hash::poseidon2_hash_with_separator,
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
        traits::{Hash, ToField},
    },
};

pub fn assert_public_storage_inclusion(
    storage_slot: Field,
    app_address: AztecAddress,
    public_data_tree_root: Field,
    public_data_preimage: PublicDataTreeLeafPreimage,
    public_data_membership_witness: MembershipWitness<PUBLIC_DATA_TREE_HEIGHT>,
) {
    let public_data_tree_index = poseidon2_hash_with_separator(
        [app_address.to_field(), storage_slot],
        GENERATOR_INDEX__PUBLIC_LEAF_INDEX,
    );
    let computed_root = root_from_sibling_path(
        public_data_preimage.hash(),
        public_data_membership_witness.leaf_index,
        public_data_membership_witness.sibling_path,
    );
    assert_eq(computed_root, public_data_tree_root, "ATR: Proving public data inclusion failed");
    assert_eq(
        public_data_preimage.slot,
        public_data_tree_index,
        "ATR: Public data tree index doesn't match witness",
    );
}
