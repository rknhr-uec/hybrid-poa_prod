use aztec::{
    prelude::AztecAddress,
    protocol_types::{
        abis::nullifier_leaf_preimage::NullifierLeafPreimage,
        constants::{NOTE_HASH_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT},
        merkle_tree::membership::MembershipWitness,
        traits::FromField,
    },
};
use uint_note::uint_note::UintNote;
mod note_validity;

global MAX_NOTES: u32 = 32;
global HONK_VK_SIZE: u32 = 112;

struct UintNoteWithoutOwner {
    randomness: Field,
    value: u128,
}

fn main(
    notes: [UintNoteWithoutOwner; MAX_NOTES],
    note_owner: pub Field,
    note_nonces: [Field; MAX_NOTES],
    token_address: pub Field,
    storage_slot: pub Field,
    nsk_app: pub Field,
    note_hash_tree_root: pub Field,
    nullifier_tree_root: pub Field,
    low_nullifier_leaf_preimages: [NullifierLeafPreimage; MAX_NOTES],
    low_nullifier_membership_witnesses: [MembershipWitness<NULLIFIER_TREE_HEIGHT>; MAX_NOTES],
    note_hash_membership_witnesses: [MembershipWitness<NOTE_HASH_TREE_HEIGHT>; MAX_NOTES],
    min_note_hash_leaf_index: pub Field,
    max_note_hash_leaf_index: pub Field,
    leaf_sum: pub u128,
    is_verifying_leaf: pub bool, // Required for recursive circuit
    vk_phantom: pub [Field; HONK_VK_SIZE], // Required for recursive circuit
) {
    let mut last_index = 0;
    let mut computed_leaf_sum = 0;

    for i in 0..MAX_NOTES {
        // If value is 0, skip
        if notes[i].value != 0 {
            note_validity::assert_note_validity(
                UintNote {
                    owner: AztecAddress::from_field(note_owner),
                    randomness: notes[i].randomness,
                    value: notes[i].value,
                },
                note_nonces[i],
                AztecAddress::from_field(token_address),
                storage_slot,
                nsk_app,
                note_hash_tree_root,
                nullifier_tree_root,
                low_nullifier_leaf_preimages[i],
                low_nullifier_membership_witnesses[i],
                note_hash_membership_witnesses[i],
            );

            // Note hash tree must be ordered from low to high to prevent double couting
            if i > 0 {
                // It's safe to cast because tree depth is 40
                assert(
                    note_hash_membership_witnesses[i - 1].leaf_index as u64
                        < note_hash_membership_witnesses[i].leaf_index as u64,
                    "ATL: Incorrect note ordering",
                );
            }

            computed_leaf_sum += notes[i].value;
            last_index = i;
        }
    }

    assert_eq(
        note_hash_membership_witnesses[0].leaf_index,
        min_note_hash_leaf_index,
        "ATL: min_note_hash_index mismatch",
    );
    assert_eq(
        note_hash_membership_witnesses[last_index].leaf_index,
        max_note_hash_leaf_index,
        "ATL: max_note_hash_index mismatch",
    );
    assert_eq(computed_leaf_sum, leaf_sum, "ATL: leaf_sum mismatch");
    assert_eq(is_verifying_leaf, true, "ATL: Invalid is_verifing_leaf");
    assert_eq(vk_phantom[0], 0, "ATL: Invalid vk_phantom"); // First element is sufficient
}
