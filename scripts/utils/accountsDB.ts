import { Fr } from '@aztec/aztec.js';
import { join } from 'path';
import { AztecAccount, getAccount } from './account.js';
import { promises as fs } from 'fs';

const filePath = join(process.cwd(), 'store/accounts.json');

export interface AztecAccountList {
  admin: AztecAccount;
  custodian: AztecAccount[];
  verifier: AztecAccount;
}

interface RawAccount {
  secretKey: string;
  salt: string;
}

interface JsonAztecAccountList {
  admin: RawAccount;
  custodian: RawAccount[];
  verifier: RawAccount;
}

export async function exportAccounts(list: AztecAccountList) {
  const custodianRawAccounts: RawAccount[] = list.custodian.map((acc) => ({
    secretKey: acc.secretKey.toString(),
    salt: acc.salt.toString(),
  }));

  const data: JsonAztecAccountList = {
    admin: {
      secretKey: list.admin.secretKey.toString(),
      salt: list.admin.salt.toString(),
    },
    custodian: custodianRawAccounts,
    verifier: {
      secretKey: list.verifier.secretKey.toString(),
      salt: list.verifier.salt.toString(),
    },
  };

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function appendCustodianAccounts(accounts: AztecAccount[]) {
  const buf = await fs.readFile(filePath, 'utf-8');
  const rawAccounts = JSON.parse(buf) as JsonAztecAccountList;

  const custodianRawAccounts: RawAccount[] = accounts.map((acc) => ({
    secretKey: acc.secretKey.toString(),
    salt: acc.salt.toString(),
  }));

  rawAccounts.custodian.push(...custodianRawAccounts);

  await fs.writeFile(filePath, JSON.stringify(rawAccounts, null, 2));
}

export async function importAccounts(maxCustodian?: number): Promise<AztecAccountList> {
  const buf = await fs.readFile(filePath, 'utf-8');
  let rawAccounts = JSON.parse(buf) as JsonAztecAccountList;

  const skAdmin = Fr.fromHexString(rawAccounts.admin.secretKey);
  const saltAdmin = Fr.fromHexString(rawAccounts.admin.salt);
  const accAdmin = await getAccount(skAdmin, saltAdmin);

  const skVerifier = Fr.fromHexString(rawAccounts.verifier.secretKey);
  const saltVerifier = Fr.fromHexString(rawAccounts.verifier.salt);
  const accVerifier = await getAccount(skVerifier, saltVerifier);

  if (maxCustodian) {
    rawAccounts.custodian = rawAccounts.custodian.slice(0, maxCustodian)
  }

  const accsCustodian: AztecAccount[] = [];
  const batchSize = 100;
  for (let i = 0; i < rawAccounts.custodian.length; i += batchSize) {
    const batch = rawAccounts.custodian.slice(i, i + batchSize);
    const batchAccounts = await Promise.all(
      batch.map(rawAcc => {
        const sk = Fr.fromHexString(rawAcc.secretKey);
        const salt = Fr.fromHexString(rawAcc.salt);
        return getAccount(sk, salt);
      }),
    );
    accsCustodian.push(...batchAccounts);
  }

  return { admin: accAdmin, verifier: accVerifier, custodian: accsCustodian };
}
