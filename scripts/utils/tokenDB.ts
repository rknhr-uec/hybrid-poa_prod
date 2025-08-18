import {
	AccountWalletWithSecretKey,
	AztecAddress,
	ContractInstanceWithAddress,
	Fr,
	getContractInstanceFromDeployParams,
} from '@aztec/aztec.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TokenContract } from '../../contracts/target/artifacts/Token.js';

const filePath = join(process.cwd(), 'store/token.json');

export async function exportToken(
	tokenInstance: ContractInstanceWithAddress,
	salt: Fr,
	constructorArgs: any[],
	constructorName: string,
) {
	const tokenData = {
		address: tokenInstance.address.toString(),
		salt: salt.toString(),
		deployer: tokenInstance.deployer.toString(),
		constructorArgs: [
			constructorArgs[0],
			constructorArgs[1],
			constructorArgs[2],
			(constructorArgs[3] as AztecAddress).toString(),
			(constructorArgs[4] as AztecAddress).toString(),
		],
		constructorName,
	};
	await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));
}

export async function importToken(wallet: AccountWalletWithSecretKey) {
	const buf = await fs.readFile(filePath, 'utf8');
	const tokenData = JSON.parse(buf);
	const tokenInstance = await getContractInstanceFromDeployParams(TokenContract.artifact, {
		salt: Fr.fromString(tokenData.salt),
		deployer: AztecAddress.fromString(tokenData.deployer),
		constructorArtifact: tokenData.constructorName,
		constructorArgs: [
			tokenData.constructorArgs[0],
			tokenData.constructorArgs[1],
			tokenData.constructorArgs[2],
			AztecAddress.fromString(tokenData.constructorArgs[3]),
			AztecAddress.fromString(tokenData.constructorArgs[4]),
		],
	});

	await wallet.registerContract({
		instance: tokenInstance,
		artifact: TokenContract.artifact,
	});

	const token = await TokenContract.at(AztecAddress.fromString(tokenData.address), wallet);
	return token;
}

export async function getTokenAddress() {
	const buf = await fs.readFile(filePath, 'utf8');
	const tokenData = JSON.parse(buf);
	const tokenAddr = AztecAddress.fromString(tokenData.address);
	return tokenAddr;
}
