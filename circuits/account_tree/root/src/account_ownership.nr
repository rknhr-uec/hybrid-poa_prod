use aztec::{
    prelude::AztecAddress,
    protocol_types::{
        address::PartialAddress,
        constants::GENERATOR_INDEX__NSK_M,
        hash::compute_app_secret_key,
        public_keys::{IvpkM, NpkM, OvpkM, PublicKeys, TpkM},
        scalar::Scalar,
    },
};
use std::embedded_curve_ops::fixed_base_scalar_mul;

pub fn assert_nsk_app(
    nsk_app: Field, // Nullifier app-siloed secret key
    nsk_m: Scalar, // Nullifier master secret key
    ivpk_m: IvpkM,
    ovpk_m: OvpkM,
    tpk_m: TpkM,
    owner_address: AztecAddress, // note owner address
    owner_partial_address: PartialAddress,
    app_address: AztecAddress, // app address (public)
) {
    let computed_nsk_app =
        compute_app_secret_key(nsk_m, app_address, GENERATOR_INDEX__NSK_M as Field);
    assert_eq(computed_nsk_app, nsk_app, "ATR: Proving computed_nsk_app == nsk_app failed");

    let npk_m = NpkM { inner: fixed_base_scalar_mul(nsk_m) };
    let public_keys = PublicKeys { npk_m, ivpk_m, ovpk_m, tpk_m };
    let computed_owner_address = AztecAddress::compute(public_keys, owner_partial_address);
    assert_eq(computed_owner_address, owner_address, "ATR: Proving computed_owner_address == owner_address failed");
}
