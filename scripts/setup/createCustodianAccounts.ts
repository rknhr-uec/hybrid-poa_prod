import { AztecAccount, createAccount } from '../utils/account.js';
import { appendCustodianAccounts, importAccounts } from '../utils/accountsDB.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'createCustodianAccounts' });

async function main() {
  const { admin } = await importAccounts();

  const createdAccs: AztecAccount[] = [];
  for (let i = 0; i < 999; i++) {
    const acc = await createAccount({ deploy: false });
    await acc.pxe.registerSender(admin.address);
    createdAccs.push(acc);
  }

  await appendCustodianAccounts(createdAccs);
}

main()
  .then(() => {
    logger.info('Custodian accounts created successfully');
    process.exit(0);
  })
  .catch((err: Error) => {
    logger.error('Failed: ', { error: err.message, stack: err.stack });
    process.exit(1);
  });
