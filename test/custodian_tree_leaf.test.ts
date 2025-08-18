import { assert, describe, expect, test } from 'vitest';
import { AccountTree } from '../scripts/tree/AccountTree/index.js';
import { CustodianLeafNode } from '../scripts/tree/CustodianTree/CustodianLeafNode.js';
import { Global } from '../scripts/tree/share/Global.js';
import { importAccounts } from '../scripts/utils/accountsDB.js';
import { aztecNode } from '../scripts/utils/pxe.js';
import { getTokenAddress } from '../scripts/utils/tokenDB.js';

describe('custodian_tree_leaf', () => {
  test('One proof', async () => {
    const threadsLeaf = 4;
    const threadsRecurse = 2;

    const { custodian } = await importAccounts(4);
    const tokenAddr = await getTokenAddress();
    const blockNumber = await aztecNode.getBlockNumber();
    const blockHeader = await aztecNode.getBlockHeader(blockNumber);
    assert.ok(blockHeader, 'blockHeader undefined');

    const sortedCustodian = custodian.sort((a, b) =>
      a.address.toBigInt() > b.address.toBigInt() ? 1 : -1,
    );

    const global: Global = {
      blockHeader,
      blockNumber,
      aztecNode: aztecNode,
      tokenAddr,
    };

    const provePromi = [];
    const accountTrees: AccountTree[] = [];
    for (let i = 0; i < 4; i++) {
      const accountTree = new AccountTree(sortedCustodian[i], global, threadsLeaf, threadsRecurse);
      accountTrees.push(accountTree);
      provePromi.push(accountTree.prove());
    }
    await Promise.all(provePromi);

    const custodianLeafNode = new CustodianLeafNode(accountTrees, global);
    const backend = await custodianLeafNode.prove({ recursive: false, skipIfExists: false });
    const result = await backend.verify();
    expect(result).to.be.true;
  });
});
