global MAX_U128: Field = 340282366920938463463374607431768211456;

pub fn safecast_to_u128(x: Field) -> u128 {
    assert(x.lt(MAX_U128), "Cast failed");
    x as u128
}