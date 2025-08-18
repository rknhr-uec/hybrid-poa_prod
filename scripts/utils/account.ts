import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { AccountManager, AccountWalletWithSecretKey, AztecAddress, Fr, PXE } from '@aztec/aztec.js';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { getPaymentMethod } from './fpc.js';
import { getStoreId, setupPXE, setupStore } from './pxe.js';
import { AztecLmdbStore } from '@aztec/kv-store/lmdb';

export interface AztecAccount {
	account: AccountManager;
	pxe: PXE;
	store: AztecLmdbStore;
	secretKey: Fr;
	salt: Fr;
	wallet: AccountWalletWithSecretKey;
	address: AztecAddress;
}

export async function createAccount(
	opts: { deploy?: boolean } = { deploy: true },
): Promise<AztecAccount> {
	const secretKey = Fr.random();
	const salt = Fr.random();

	const storeId = getStoreId(secretKey.toBuffer());
	const store = await setupStore(storeId);
	const pxe = await setupPXE(store, true);

	const schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
	const wallet = await schnorrAccount.getWallet();
	const address = wallet.getAddress();

	if (opts.deploy) {
		const paymentMethod = await getPaymentMethod();
		const tx = await schnorrAccount
			.deploy({
				fee: { paymentMethod },
			})
			.wait({ timeout: 120000 });
		await pxe.getTxEffect(tx.txHash);
	} else {
		const completeAddress = await schnorrAccount.getCompleteAddress();
		await pxe.registerAccount(secretKey, completeAddress.partialAddress);
	}

	return {
		account: schnorrAccount,
		store,
		pxe,
		secretKey,
		salt,
		wallet,
		address,
	};
}

export async function getAccount(secretKey: Fr, salt: Fr): Promise<AztecAccount> {
	const storeId = getStoreId(secretKey.toBuffer());
	const store = await setupStore(storeId);
	const pxe = await setupPXE(store);
	const account = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
	const wallet = await account.getWallet();

	return {
		account,
		store,
		pxe,
		secretKey,
		salt,
		wallet,
		address: wallet.getAddress(),
	};
}
