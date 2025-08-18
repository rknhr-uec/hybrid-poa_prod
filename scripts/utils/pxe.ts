import { createPXEService, getPXEServiceConfig, PXEService, PXEServiceConfig } from '@aztec/pxe/server';
import { AztecLmdbStore, createStore } from '@aztec/kv-store/lmdb';
import { createAztecNodeClient, waitForPXE } from '@aztec/aztec.js';
import { getSponsoredFPCInstance } from './fpc.js';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'node:crypto';

export const { NODE_URL = 'http://localhost:8080' } = process.env;
export const aztecNode = createAztecNodeClient(NODE_URL);

const STORE_DIR = 'store';

export async function flushStore() {
  await fs.rm(join(process.cwd(), STORE_DIR), { recursive: true, force: true });
}

export async function setupStore(name: string) {
  const store = await createStore(name, {
    dataDirectory: STORE_DIR,
    dataStoreMapSizeKB: 1e6,
  });
  return store;
}

export async function setupPXE(store: AztecLmdbStore, init?: boolean) {
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config: PXEServiceConfig = getPXEServiceConfig();
  const fullConfig = { ...config, l1Contracts, proverEnabled: false };

  const pxe = await createPXEService(aztecNode, fullConfig, { store });
  await waitForPXE(pxe);

  if (init) {
    await registerFPC(pxe);
  }

  return pxe;
}

export function getStoreId(buf: Buffer) {
  const id = createHash('sha256')
    .update(buf)
    .digest('base64url')
    .replaceAll('-', '')
    .replaceAll('_', '')
    .substring(0, 10)
    .toLowerCase();
  return id;
}

async function registerFPC(pxe: PXEService) {
  const sponsoredFPC = await getSponsoredFPCInstance();
  await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
}
