import { Contract, Fr } from '@aztec/aztec.js';
import { TokenContractArtifact } from '../../contracts/target/artifacts/Token.js';
import { importAccounts } from '../utils/accountsDB.js';
import { getPaymentMethod } from '../utils/fpc.js';
import { exportToken } from '../utils/tokenDB.js';

async function main() {
	const { admin } = await importAccounts();

	const salt = Fr.random();
	const paymentMethod = await getPaymentMethod();
  
	const constructorArgs = ['Hybrid_PoA_Token', 'HPT', 6, admin.address, admin.address];
	const constructorName = 'constructor_with_minter';
	const token = await Contract.deploy(
		admin.wallet,
		TokenContractArtifact,
		constructorArgs,
		constructorName,
	)
		.send({
			contractAddressSalt: salt,
			fee: { paymentMethod },
		})
		.wait();
	await exportToken(token.contract.instance, salt, constructorArgs, constructorName);
}

main()
	.then(() => process.exit(0))
	.catch((err: Error) => {
		console.error(err);
		process.exit(1);
	});
