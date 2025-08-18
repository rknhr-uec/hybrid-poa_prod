#!/bin/bash
set -e

generate_vk() {
    local circuit_name="$1"
    
    if [ "$circuit_name" = "custodian_tree_root" ]; then
        bb write_vk -b "./target/${circuit_name}.json" -o ./target --output_format bytes_and_fields --oracle_hash keccak
        bb write_solidity_verifier --zk -k ./target/vk -o ../contracts/verifier_contract/lib.sol
    else
        bb write_vk -b "./target/${circuit_name}.json" -o ./target --output_format bytes_and_fields --honk_recursion 1 --init_kzg_accumulator
    fi
    mv ./target/vk "./target/${circuit_name}_vk"
    mv ./target/vk_fields.json "./target/${circuit_name}_vk_fields.json"
    
    if [ "$circuit_name" != "custodian_tree_root" ]; then
        bb write_vk -b "./target/${circuit_name}.json" -o ./target --oracle_hash keccak
        mv ./target/vk "./target/${circuit_name}_vk_keccak"
    fi
}

mkdir -p ./target
nargo compile

generate_vk "account_tree_leaf"
generate_vk "account_tree_internal"
generate_vk "account_tree_root"
generate_vk "custodian_tree_leaf"
generate_vk "custodian_tree_internal"
generate_vk "custodian_tree_root"
