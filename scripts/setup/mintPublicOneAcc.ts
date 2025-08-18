import { importAccounts } from '../utils/accountsDB.js';
import { getPaymentMethod } from '../utils/fpc.js';
import { getRandomAmount } from '../utils/random.js';
import { importToken } from '../utils/tokenDB.js';

async function main() {
	const { admin, custodian } = await importAccounts();
	const token = await importToken(admin.wallet);
	const paymentMethod = await getPaymentMethod();

	const dst = custodian[0].address;
	const amount = getRandomAmount();
	const tx = await token.methods
		.mint_to_public(dst, amount)
		.send({ fee: { paymentMethod } })
		.wait();
	await admin.pxe.getTxEffect(tx.txHash);

	const balance = await token.methods.balance_of_public(dst).simulate();
	console.log(`Public balance of ${dst.toString()} after mint: ${balance.toString()}`);
}

main()
	.then(() => process.exit(0))
	.catch((err: Error) => {
		console.error(err);
		process.exit(1);
	});
