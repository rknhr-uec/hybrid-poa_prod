import { importAccounts } from '../utils/accountsDB.js';
import { getPaymentMethod } from '../utils/fpc.js';
import { getRandomAmount } from '../utils/random.js';
import { importToken } from '../utils/tokenDB.js';
import { logger as baseLogger } from '../utils/logger.js';

const NUM = 1000;
const maxRetries = 3;
const logger = baseLogger.child({ module: 'mintPublicMulAcc' });

async function main() {
  const { admin, custodian } = await importAccounts();
  const token = await importToken(admin.wallet);
  const paymentMethod = await getPaymentMethod();

  for (let i = 0; i < NUM; i++) {
    const dst = custodian[i].address;
    logger.info(`Minting account ${i + 1} of ${NUM}`);

    const amount = getRandomAmount();
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await token.methods
          .mint_to_public(dst, amount)
          .send({ fee: { paymentMethod } })
          .wait();
        break;
      } catch (err: any) {
        logger.warn(`Failed mint attempt ${attempt}`)
        if (attempt >= maxRetries) {
          throw err;
        }
      }
    }
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
