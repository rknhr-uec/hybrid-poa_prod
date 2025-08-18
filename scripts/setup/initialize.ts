import { createAccount } from '../utils/account.js';
import { exportAccounts } from '../utils/accountsDB.js';
import { flushStore } from '../utils/pxe.js';

async function main() {
	await flushStore();

	const admin = await createAccount({ deploy: true });
	const verifier = await createAccount({ deploy: true });
	const custodian = await createAccount({ deploy: true });
	await exportAccounts({ admin, verifier, custodian: [custodian] });

	await admin.pxe.registerSender(admin.address);
	await custodian.pxe.registerSender(admin.address);
	await verifier.pxe.registerSender(admin.address);
}

main()
	.then(() => process.exit(0))
	.catch((err: Error) => {
		console.error(err);
		process.exit(1);
	});
