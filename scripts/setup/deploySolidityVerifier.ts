import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const ARTIFACT_PATH = path.join(process.cwd(), 'contracts', 'out', 'Verifier.sol', 'Verifier.json');

function loadArtifact(): { abi: any[]; bytecode: string } {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(`Verifier artifact missing at ${ARTIFACT_PATH}. Run 'forge build' first.`);
  }
  const json = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const rawBytecode = json.bytecode?.object || json.bytecode;
  if (!json.abi || !rawBytecode) throw new Error('Malformed Verifier artifact: missing abi or bytecode');
  return { abi: json.abi, bytecode: rawBytecode.startsWith('0x') ? rawBytecode : `0x${rawBytecode}` };
}

async function main() {
  const artifact = loadArtifact();
  const bytecodeHex = artifact.bytecode as `0x${string}`;

  const defaultMnemonic = 'test test test test test test test test test test test junk';
  const account = mnemonicToAccount((process.env.MNEMONIC || defaultMnemonic), { accountIndex: 0 });

  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  const txHash = await walletClient.deployContract({ abi: artifact.abi, bytecode: bytecodeHex, args: [] });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('Deployment failed');

  const address = receipt.contractAddress;
  console.log('Verifier deployed at', address);

  const outDir = path.join(process.cwd(), 'store');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'verifier.json'),
    JSON.stringify({ address, abi: artifact.abi }, null, 2)
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
