import { deriveKeys, Fr } from '@aztec/aztec.js';
import { KeyStore } from '@aztec/key-store';
import { CompiledCircuit, InputMap, Noir } from '@aztec/noir-noir_js';
import { computePartialAddress } from '@aztec/stdlib/contract';
import { computePublicDataTreeLeafSlot, deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import { computeAppSecretKey, KEY_PREFIXES } from '@aztec/stdlib/keys';
import accountTreeInternalVk from '../../../circuits/target/account_tree_internal_vk_fields.json' with { type: 'json' };
import accountTreeRootCircuit from '../../../circuits/target/account_tree_root.json' with { type: 'json' };
import { TokenContract } from '../../../contracts/target/artifacts/Token.js';
import { AccountTreeRootInput, PublicDataTreeLeafPreimage } from '../../types/AccountTreeRoot.js';
import { AztecAccount } from '../../utils/account.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';

export class AccountRootNode extends TreeNode {
	constructor(
		readonly childNode: TreeNode,
		readonly account: AztecAccount,
		readonly global: Global,
	) {
		super();

		if (!this.childNode.hasProven()) {
			throw new Error('Child node has not proven yet');
		}
	}

	async prove(opt: ProveOption = DEFAULT_PROVE_OPTION) {
		const childBackend = this.childNode.getBackend();
		const childProof = await childBackend.readProof();

		const publicBalancesStorageSlot = await deriveStorageSlotInMap(
			TokenContract.storage.public_balances.slot,
			this.account.address,
		);
		const publicDataLeafSlot = await computePublicDataTreeLeafSlot(
			this.global.tokenAddr,
			publicBalancesStorageSlot,
		);
		const publicDataWitness = await this.global.aztecNode.getPublicDataWitness(
			this.global.blockNumber,
			publicDataLeafSlot,
		);
		if (!publicDataWitness) {
			throw new Error('publicDataWitness undefined');
		}

		const publicBalanceField = await this.global.aztecNode.getPublicStorageAt(
			this.global.blockNumber,
			this.global.tokenAddr,
			publicBalancesStorageSlot,
		);
		const publicDataPreImage: PublicDataTreeLeafPreimage = publicBalanceField.isZero()
			? {
					slot: Fr.ZERO,
					value: Fr.ZERO,
					next_index: '0',
					next_slot: Fr.ZERO,
				}
			: {
					slot: publicDataLeafSlot,
					value: publicDataWitness.leafPreimage.leaf.value,
					next_index: publicDataWitness.leafPreimage.nextIndex.toString(),
					next_slot: publicDataWitness.leafPreimage.nextKey,
				};
		const accountTotalBalance =
			BigInt(publicBalanceField.toString()) + BigInt(childProof.publicInputs[8].toString());

		const { masterNullifierSecretKey } = await deriveKeys(this.account.secretKey);
		const nskApp = await computeAppSecretKey(
			masterNullifierSecretKey,
			this.global.tokenAddr,
			KEY_PREFIXES[0],
		);
		const keyStore = new KeyStore(this.account.store);

		const circuitInput: AccountTreeRootInput = {
			account_address: { inner: this.account.address.toField() },
			token_address: { inner: this.global.tokenAddr.toField() },
			account_total_balance: accountTotalBalance.toString(),

			public_balances_map_storage_slot: TokenContract.storage.public_balances.slot,
			public_data_tree_root: this.global.blockHeader.state.partial.publicDataTree.root,
			public_data_preimage: publicDataPreImage,
			public_data_membership_witness: {
				sibling_path: publicDataWitness.siblingPath.toFields(),
				leaf_index: publicDataWitness.index.toString(),
			},

			private_balances_map_storage_slot: TokenContract.storage.private_balances.slot,
			nsk_app: nskApp,
			nsk_m: {
				lo: masterNullifierSecretKey.lo,
				hi: masterNullifierSecretKey.hi,
			},
			ivpk_m: (
				await keyStore.getMasterIncomingViewingPublicKey(this.account.address)
			).toWrappedNoirStruct(),
			ovpk_m: (
				await keyStore.getMasterOutgoingViewingPublicKey(this.account.address)
			).toWrappedNoirStruct(),
			tpk_m: (await keyStore.getMasterTaggingPublicKey(this.account.address)).toWrappedNoirStruct(),
			owner_partial_address: {
				inner: (await computePartialAddress(this.account.account.getInstance())).toField(),
			},
			note_hash_tree_root: this.global.blockHeader.state.partial.noteHashTree.root,
			nullifier_tree_root: this.global.blockHeader.state.partial.nullifierTree.root,
			vk: accountTreeInternalVk.map((i) => Fr.fromString(i)),
			proof: childProof.proof,
			public_inputs: childProof.publicInputs,
		};

		const noir = new Noir(accountTreeRootCircuit as CompiledCircuit);
		const { witness } = await noir.execute(circuitInput as any as InputMap);
		const backend = new NativeUltraHonkBackend('account_tree_root', witness);

		await backend.prove(opt);

		if (opt.flushChild) {
			await childBackend.flush();
		}

		this.backend = backend;

		return backend;
	}
}
