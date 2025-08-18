import { Logger } from 'winston';
import { MAX_PROOFS } from '../../types/share.js';
import { AztecAccount } from '../../utils/account.js';
import { NativeUltraHonkBackend } from '../../utils/bb.js';
import { logger as baseLogger } from '../../utils/logger.js';
import { AccountTree } from '../AccountTree/index.js';
import { Global } from '../share/Global.js';
import { DEFAULT_PROVE_OPTION, ProveOption, TreeNode } from '../share/TreeNode.js';
import { CustodianInternalNode } from './CustodianInternalNode.js';
import { CustodianLeafNode } from './CustodianLeafNode.js';
import { CustodianRootNode } from './CustodianRootNode.js';

export class CustodianTree {
  protected backend: NativeUltraHonkBackend | undefined;
  private logger: Logger;

  constructor(
    readonly accounts: AztecAccount[],
    readonly global: Global,
    readonly threadsLeaf: number,
    readonly threadsRecurse: number,
    readonly threadsAccount: number,
  ) {
    if (threadsLeaf < 1 || threadsRecurse < 1 || threadsAccount < 1) {
      throw new Error('Invalid thread');
    }

    this.logger = baseLogger.child({ module: 'CustodianTree' })
  }

  async prove(opt: ProveOption = DEFAULT_PROVE_OPTION) {
    const accountTrees = this.buildAccountTrees();
    this.logger.info(`Start proving ${accountTrees.length} accounts`);

    this.logger.info(`Start building ${accountTrees.length} account trees`)
    for (let i = 0; i < accountTrees.length; i += this.threadsAccount) {
      const batch = accountTrees.slice(i, i + this.threadsAccount);
      this.logger.info(`Working on batch ${i}-${i + batch.length - 1}`)

      await Promise.all(
        batch.map((accountTree) => accountTree.prove({ ...opt, recursive: true, zk: false })),
      );
      this.logger.info(`Built ${i + batch.length - 1 + 1}/${accountTrees.length} account trees`)
    }

    const leafNodes = this.buildCustodianLeafNodes(accountTrees);
    this.logger.info(`Started proving ${leafNodes.length} custodian leaf nodes`);

    for (let i = 0; i < leafNodes.length; i += this.threadsRecurse) {
      const batch = leafNodes.slice(i, i + this.threadsRecurse);

      this.logger.info(`Working on batch ${i}-${i + batch.length - 1}`)

      await Promise.all(batch.map((node) => node.prove({ ...opt, recursive: true, zk: false })));

      this.logger.info(`Built ${i + batch.length - 1 + 1}/${leafNodes.length} custodian leaf nodes`)
    }

    this.logger.info(`Now aggreating ${leafNodes.length} custodian leaf nodes to 1 node`)
    const lastInternalNode = await this.aggreate(leafNodes, true, 1);
    const rootNode = new CustodianRootNode(lastInternalNode, this.global);

    this.logger.info('Proving custodian root');
    await rootNode.prove({ ...opt, recursive: false });

    this.logger.info('Custodian root proven')

    return rootNode.getBackend();
  }

  private async aggreate(
    nodes: TreeNode[],
    isLeafNode: boolean,
    level: number,
  ): Promise<TreeNode> {
    if (nodes.length == 1 && !isLeafNode) {
      return nodes[0];
    }

    const internalNodes = this.buildInternalNodes(nodes, isLeafNode);
    this.logger.info(`Agg lvl ${level}: proving ${internalNodes.length} custodian internal nodes`);

    for (let i = 0; i < internalNodes.length; i += this.threadsRecurse) {
      const batch = internalNodes.slice(i, i + this.threadsRecurse);
      await Promise.all(batch.map((node) => node.prove({ recursive: true, skipIfExists: true })));
    }
    return this.aggreate(internalNodes, false, level + 1);
  }

  private buildAccountTrees() {
    const sortedAccounts = this.accounts.sort((a, b) =>
      a.address.toBigInt() > b.address.toBigInt() ? 1 : -1,
    );
    const accountTrees = sortedAccounts.map(
      (acc) => new AccountTree(acc, this.global, this.threadsLeaf, this.threadsRecurse),
    );
    return accountTrees;
  }

  private buildCustodianLeafNodes(accountTrees: AccountTree[]) {
    const groupedAccountTrees = Array.from(
      { length: Math.ceil(accountTrees.length / MAX_PROOFS) },
      (_, i) => accountTrees.slice(i * MAX_PROOFS, (i + 1) * MAX_PROOFS),
    );
    const leafNodes = groupedAccountTrees.map(
      (accountTrees) => new CustodianLeafNode(accountTrees, this.global),
    );
    return leafNodes;
  }

  private buildInternalNodes(nodes: TreeNode[], isLeafNode: boolean) {
    const groupedNodes = Array.from({ length: Math.ceil(nodes.length / MAX_PROOFS) }, (_, i) =>
      nodes.slice(i * MAX_PROOFS, (i + 1) * MAX_PROOFS),
    );
    const internalNodes = groupedNodes.map(
      (nodes) => new CustodianInternalNode(nodes, isLeafNode, this.global),
    );
    return internalNodes;
  }
}
