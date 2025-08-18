use aztec::{
    note::{
        note_interface::NoteHash,
        note_metadata::{NoteMetadata, SettledNoteMetadata},
        retrieved_note::RetrievedNote,
    },
    prelude::AztecAddress,
    protocol_types::{
        abis::nullifier_leaf_preimage::NullifierLeafPreimage,
        constants::{GENERATOR_INDEX__NOTE_NULLIFIER, NOTE_HASH_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT},
        hash::{
            compute_siloed_note_hash, compute_siloed_nullifier, compute_unique_note_hash,
            poseidon2_hash_with_separator,
        },
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
        traits::Hash,
    },
};

pub fn assert_note_validity<Note>(
    note: Note,
    note_nonce: Field,
    contract_address: AztecAddress,
    storage_slot: Field,
    nsk_app: Field,
    note_hash_tree_root: Field,
    nullifier_tree_root: Field,
    low_nullifier_leaf_preimage: NullifierLeafPreimage,
    low_nullifier_membership_witness: MembershipWitness<NULLIFIER_TREE_HEIGHT>,
    note_hash_membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
)
where
    Note: NoteHash,
{
    let retrieved_note = RetrievedNote {
        note,
        contract_address,
        metadata: NoteMetadata::from(SettledNoteMetadata::new(note_nonce)),
    };
    let note_hash = compute_note_hash(retrieved_note, storage_slot);
    let nullifier = compute_nullifier(retrieved_note, note_hash, nsk_app);

    assert_note_hash_inclusion(note_hash, note_hash_membership_witness, note_hash_tree_root);
    assert_nullifier_non_inclusion(
        nullifier,
        low_nullifier_leaf_preimage,
        low_nullifier_membership_witness,
        nullifier_tree_root,
    );
}

fn assert_note_hash_inclusion(
    note_hash: Field,
    note_hash_membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    note_hash_tree_root: Field,
) {
    let computed_root = root_from_sibling_path(
        note_hash,
        note_hash_membership_witness.leaf_index,
        note_hash_membership_witness.sibling_path,
    );
    assert_eq(computed_root, note_hash_tree_root, "ATL: Proving note hash inclusion failed");
}

fn assert_nullifier_non_inclusion(
    nullifier: Field,
    low_nullifier_leaf_preimage: NullifierLeafPreimage,
    low_nullifier_membership_witness: MembershipWitness<NULLIFIER_TREE_HEIGHT>,
    nullifier_tree_root: Field,
) {
    let computed_root = root_from_sibling_path(
        low_nullifier_leaf_preimage.hash(),
        low_nullifier_membership_witness.leaf_index,
        low_nullifier_membership_witness.sibling_path,
    );

    assert_eq(computed_root, nullifier_tree_root, "ATL: Proving low nullifier inclusion failed");
    assert(
        low_nullifier_leaf_preimage.nullifier.lt(nullifier),
        "ATL: Proving low_nullifier.value < nullifier.value failed",
    );
    assert(
        nullifier.lt(low_nullifier_leaf_preimage.next_nullifier)
            | (low_nullifier_leaf_preimage.next_index == 0),
        "ATL: Proving low_nullifier.next_value > nullifier.value failed",
    );
}

fn compute_note_hash<Note>(retrieved_note: RetrievedNote<Note>, storage_slot: Field) -> Field
where
    Note: NoteHash,
{
    let note_hash = retrieved_note.note.compute_note_hash(storage_slot);
    let siloed_note_hash = compute_siloed_note_hash(retrieved_note.contract_address, note_hash);
    compute_unique_note_hash(
        retrieved_note.metadata.to_settled().note_nonce(),
        siloed_note_hash,
    )
}

fn compute_nullifier<Note>(
    retrieved_note: RetrievedNote<Note>,
    note_hash: Field,
    nsk_app: Field,
) -> Field
where
    Note: NoteHash,
{
    let inner_nullifier =
        poseidon2_hash_with_separator([note_hash, nsk_app], GENERATOR_INDEX__NOTE_NULLIFIER);
    compute_siloed_nullifier(retrieved_note.contract_address, inner_nullifier)
}
