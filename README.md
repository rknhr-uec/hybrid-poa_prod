# Hybrid Proof of Assets

Proof of Assets on Hybrid Blockchains

## Requirements

Must use the following versions:
- Node: 22.15.1
- Aztec: 1.1.2
- Noir: 1.0.0-beta.7
- Barrtenberg: 0.87.0
- Foundry

## Setup

Start the sandbox

```sh
aztec start --sandbox
```

Setup PXE and deploy accounts

```sh
tsx ./scripts/setup/initialize.ts
```

Deploy token contract

```sh
tsx ./scripts/setup/deployToken.ts
```

Create custodian accounts (without deploying)

```sh
tsx ./scripts/setup/createCustodianAccounts.ts
```

Mint public and private balance

```sh
tsx ./scripts/setup/mintPublicMulAcc.ts
tsx ./scripts/setup/mintPrivateMulAcc.ts
```

Deploy solidity verifier

```sh
tsx ./scripts/setup/deploySolidityVerifier.ts
```

## Testing

Warning: Must have completed the setup

```sh
yarn test
```


## Benchmarking

Warning: Must have completed the setup 

```sh

```
