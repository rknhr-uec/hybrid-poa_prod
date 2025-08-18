import { expect, test } from 'vitest';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { importToken } from '../scripts/utils/tokenDB.js';

test('Private balance is synced', async () => {
  const { custodian, verifier } = await importAccounts();
  const tokenCustodian = await importToken(custodian[0].wallet);
  const tokenVerifier = await importToken(verifier.wallet);

  await tokenCustodian.methods.sync_private_state().simulate();
  await tokenVerifier.methods.sync_private_state().simulate();

  const balanceFromCustodian = await tokenCustodian.methods
    .balance_of_private(custodian[0].address)
    .simulate();
  expect(balanceFromCustodian > 0, 'Private balance not synced');

  const balanceFromVerifier = await tokenCustodian.methods
    .balance_of_private(custodian[0].address)
    .simulate();
  expect(balanceFromVerifier == 0, 'Private balance leak');
});

test('Minted to first 4 accounts', async () => {
  const { custodian } = await importAccounts();
  for (let i = 0; i < 4; i++) {
    const acc = custodian[i];
    const token = await importToken(acc.wallet);
    const balance: bigint = await token.methods.balance_of_private(acc.address).simulate();
    expect(balance > 0, `Not minted to account ${i}`);
  }
});
