import fs from 'fs';
import path from 'path';
import { Address, createPublicClient, http } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const ARTIFACT_PATH = path.join(process.cwd(), 'contracts', 'out', 'Verifier.sol', 'Verifier.json');

function loadAbi(): any[] {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(`Verifier artifact missing at ${ARTIFACT_PATH}. Run 'forge build' first.`);
  }
  const json = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  if (!json.abi) throw new Error('Artifact missing abi');
  return json.abi;
}

function loadVerifierAddress(): Address {
  try {
    const p = path.join(process.cwd(), 'store', 'verifier.json');
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    return json.address;
  } catch (_) {
    throw new Error("Verifier contract not deployed")
  }
}

export async function verifyInSolidity(proof: string, publicInputs: string[]): Promise<{ gas: bigint; result: boolean; }> {
  const verifierAbi = loadAbi();
  const address = loadVerifierAddress();
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const mnemonic = process.env.MNEMONIC || 'test test test test test test test test test test test junk';

  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const account = mnemonicToAccount(mnemonic, { accountIndex: 0 });

  const simulation = await publicClient.simulateContract({
    address,
    abi: verifierAbi,
    functionName: 'verifyPublic',
    args: [proof, publicInputs],
    account
  });
  const gas = await publicClient.estimateContractGas({
    address,
    abi: verifierAbi,
    functionName: 'verifyPublic',
    args: [proof, publicInputs],
    account
  })

  return { gas, result: simulation.result as any as boolean };
}
