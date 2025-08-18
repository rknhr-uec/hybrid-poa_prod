import { NativeUltraHonkBackend } from '../../utils/bb.js';

export type ProveOption = {
  recursive?: boolean;
  skipIfExists?: boolean;
  flushChild?: boolean;
  zk?: boolean;
};

export const DEFAULT_PROVE_OPTION: ProveOption = {
  recursive: true,
  skipIfExists: true,
  flushChild: false,
  zk: false,
};

export abstract class TreeNode {
  protected backend: NativeUltraHonkBackend | undefined;

  abstract prove(opt: ProveOption): Promise<NativeUltraHonkBackend>;

  public getBackend() {
    if (!this.backend) {
      throw new Error('Backend not defined');
    }
    return this.backend;
  }

  public hasProven() {
    return this.backend !== undefined;
  }

  public async verify(opts: { zk?: boolean }) {
    if (this.backend === undefined) {
      throw new Error('Not proved yet');
    }

    return this.backend.verify(opts);
  }
}
