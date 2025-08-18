import { NoteDataProvider } from '@aztec/pxe/server';
import { NotesFilter } from '@aztec/stdlib/note';
import { importAccounts } from '../utils/accountsDB.js';
import { getPaymentMethod } from '../utils/fpc.js';
import { getRandomAmount } from '../utils/random.js';
import { importToken } from '../utils/tokenDB.js';

async function main() {
	const { custodian, admin } = await importAccounts();
	const token = await importToken(admin.wallet);
	const paymentMethod = await getPaymentMethod();

	const dstAcc = custodian[0];
	const amounts = Array(16)
		.fill(0)
		.map((_) => getRandomAmount());
	const tx = await token.methods
		.mint_to_private_batch(admin.address, dstAcc.address, amounts)
		.send({
			fee: {
				paymentMethod,
			},
		})
		.wait();
	await admin.pxe.getTxEffect(tx.txHash);

	const tokenCustodian = await importToken(dstAcc.wallet);
	await tokenCustodian.methods.sync_private_state().simulate();

	const balance = await tokenCustodian.methods.balance_of_private(dstAcc.address).simulate();
	console.log(`Private balance of ${dstAcc.address.toString()} after mint: ${balance.toString()}`);

	const notesFilter: NotesFilter = {
		contractAddress: token.address,
		recipient: dstAcc.address,
	};
	const noteDataProvider = await NoteDataProvider.create(dstAcc.store);
	const noteDaos = await noteDataProvider.getNotes(notesFilter);
	console.log(`Notes of ${dstAcc.address.toString()} after mint: ${noteDaos.length}`);
}

main()
	.then(() => process.exit(0))
	.catch((err: Error) => {
		console.error(err);
		process.exit(1);
	});
