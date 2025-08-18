import {
	type ContractInstanceWithAddress,
	Fr,
	type PXE,
	SponsoredFeePaymentMethod,
	type Wallet,
	getContractInstanceFromDeployParams,
} from '@aztec/aztec.js';
import type { LogFn } from '@aztec/foundation/log';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';

const SPONSORED_FPC_SALT = new Fr(0);

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
	return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
		salt: SPONSORED_FPC_SALT,
	});
}

async function getSponsoredFPCAddress() {
	return (await getSponsoredFPCInstance()).address;
}

export async function getPaymentMethod() {
	const sponsoredFPC = await getSponsoredFPCInstance();
	const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
	return paymentMethod;
}

export async function setupSponsoredFPC(deployer: Wallet, log: LogFn) {
	const deployed = await SponsoredFPCContract.deploy(deployer)
		.send({ contractAddressSalt: SPONSORED_FPC_SALT, universalDeploy: true })
		.deployed();

	log(`SponsoredFPC: ${deployed.address}`);
}

export async function getDeployedSponsoredFPCAddress(pxe: PXE) {
	const fpc = await getSponsoredFPCAddress();
	const contracts = await pxe.getContracts();
	if (!contracts.find((c) => c.equals(fpc))) {
		throw new Error('SponsoredFPC not deployed.');
	}
	return fpc;
}
