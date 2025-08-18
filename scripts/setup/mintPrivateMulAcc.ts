import { importAccounts } from '../utils/accountsDB.js';
import { getPaymentMethod } from '../utils/fpc.js';
import { getRandomAmount } from '../utils/random.js';
import { importToken } from '../utils/tokenDB.js';
import { logger as baseLogger } from '../utils/logger.js';

const NUM = 1000;
const maxRetries = 3;
const logger = baseLogger.child({ module: 'mintPrivateMulAcc' });

async function main() {
	const { custodian, admin } = await importAccounts();
	const tokenAdmin = await importToken(admin.wallet);
	const paymentMethod = await getPaymentMethod();

	for (let i = 0; i < NUM; i++) {
		const dstAcc = custodian[i];
		logger.info(`Minting account ${i + 1} of ${NUM}`);

		for (let j = 0; j < 7; j++) {
			const amounts = Array(16)
				.fill(0)
				.map((_) => getRandomAmount());
			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					await tokenAdmin.methods
						.mint_to_private_batch(admin.address, dstAcc.address, amounts)
						.send({
							fee: { paymentMethod },
						})
						.wait();
					break;
				} catch (err: any) {
					logger.warn(`Failed mint attempt ${attempt}`);
					if (attempt >= maxRetries) {
						throw err;
					}
				}
			}
		}

		// Add 1 sec delay for tx to take effect
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const tokenCustodian = await importToken(dstAcc.wallet);
		await tokenCustodian.methods.sync_private_state().simulate();
	}
}

main()
	.then(() => {
		logger.info('Mint complete');
		process.exit(0);
	})
	.catch((err: Error) => {
		logger.error('Failed: ', { error: err.message, stack: err.stack });
		process.exit(1);
	});
