import { Fr } from '@aztec/aztec.js';
import { promises as fs } from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'os';
import { join } from 'path';
import { ProveOption } from '../tree/share/TreeNode.js';

const homeDir = os.homedir();
const cwdDir = process.cwd();

export class NativeUltraHonkBackend {
  private bbPath = join(homeDir, '.bb/bb');
  private outputDir: string;
  private circuitDir: string;
  private circuitPath: string;
  private witnessPath: string;
  private proofPath: string;
  private proofFieldsPath: string;
  private publicInputPath: string;
  private publicInputsFieldsPath: string;
  public id: string;

  constructor(
    private circuitName: string,
    private witness: Uint8Array,
  ) {
    const id = getId(witness);
    const circuitsDir = join(cwdDir, 'circuits/target');
    const outputBaseDir = join(cwdDir, 'circuits/proof');

    this.id = id;
    this.circuitDir = circuitsDir;
    this.circuitPath = join(circuitsDir, `${this.circuitName}.json`);
    this.outputDir = join(outputBaseDir, this.circuitName, id);
    this.witnessPath = join(this.outputDir, `${this.circuitName}.gz`);
    this.proofPath = join(this.outputDir, 'proof');
    this.proofFieldsPath = join(this.outputDir, 'proof_fields.json');
    this.publicInputPath = join(this.outputDir, 'public_inputs');
    this.publicInputsFieldsPath = join(this.outputDir, 'public_inputs_fields.json');
  }

  async prove(proveOpts: { recursive?: boolean, zk?: boolean, skipIfExists?: boolean }) {
    if ((await fileExists(this.proofFieldsPath)) && proveOpts.skipIfExists) {
      return this.readProof();
    }

    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.writeFile(this.witnessPath, this.witness);

    const cmd = 'prove';
    const opts = [
      '-b',
      this.circuitPath,
      '-w',
      this.witnessPath,
      '-o',
      this.outputDir,
      '--output_format',
      'bytes_and_fields',
    ];
    if (proveOpts.recursive) {
      opts.push(...['--honk_recursion', '1', '--recursive', '--init_kzg_accumulator']);
    }
    if (proveOpts.zk) {
      opts.push(...['--zk', '--oracle_hash', 'keccak']);
    }

    const bbProcess = spawn(this.bbPath, [cmd, ...opts]);

    return processResolver(bbProcess, () => this.readProof());
  }

  async readProof() {
    const proofRaw = await fs.readFile(this.proofFieldsPath, 'utf-8');
    const publicInputsRaw = await fs.readFile(this.publicInputsFieldsPath, 'utf-8');
    const proof = bufToFrArray(proofRaw);
    const publicInputs = bufToFrArray(publicInputsRaw);

    return { proof, publicInputs };
  }

  async getProofForSol() {
    const proofRaw = await fs.readFile(this.proofFieldsPath, 'utf-8');
    const proofFrArr = bufToFrArray(proofRaw);
    const proof = '0x' + proofFrArr.slice(0, 507).map(i => i.toString().substring(2, 66)).join('');
    const publicInputsRaw = await fs.readFile(this.publicInputsFieldsPath, 'utf-8');
    const publicInputs = JSON.parse(publicInputsRaw) as string[]
    return { proof, publicInputs }
  }

  async verify(verifyOpts: { zk?: boolean } = { zk: false }) {
    const cmd = 'verify';
    const vkPath = join(this.circuitDir, `${this.circuitName}${verifyOpts.zk ? '_vk_keccak' : '_vk'}`);
    const opts = ['-k', vkPath, '-p', this.proofPath, '-i', this.publicInputPath];
    if (verifyOpts.zk) {
      opts.push(...['--zk', '--oracle_hash', 'keccak']);
    }

    const bbProcess = spawn(this.bbPath, [cmd, ...opts]);

    return processResolver(bbProcess, async () => {
      return true;
    });
  }

  async flush() {
    await fs.rm(this.outputDir, { recursive: true, force: true });
  }
}

async function fileExists(filepath: string) {
  try {
    return (await fs.lstat(filepath)).isFile();
  } catch (e) {
    return false;
  }
}

function getId(witness: Uint8Array) {
  const id = createHash('sha256')
    .update(witness)
    .digest('base64url')
    .replaceAll('-', '')
    .replaceAll('_', '')
    .substring(0, 10)
    .toLowerCase();
  return id;
}

function processResolver<T>(process: ChildProcessWithoutNullStreams, onClose: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const errMsgs: string[] = [];

    process.stderr.on('data', (data: string) => {
      errMsgs.push(data);
    });

    process.on('close', async (code: number) => {
      if (code !== 0) {
        const flattedErrMsg = errMsgs.reduce((acc, msg, index) => {
          return acc.concat(`${index + 1}) `).concat(acc ? msg : msg + '\n');
        }, '');
        reject(
          new Error(
            `Process exited with code ${code} with following messages: \n ${flattedErrMsg}`,
          ),
        );
        return;
      }

      try {
        const onCloseReturn = await onClose();
        resolve(onCloseReturn);
      } catch (err) {
        reject(new Error(`Callback failed: ${err}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start process: ${err.message}`));
    });
  });
}

function bufToFrArray(buf: string) {
  return (JSON.parse(buf) as string[]).map((i) => Fr.fromString(i));
}
