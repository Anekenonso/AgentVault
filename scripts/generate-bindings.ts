/**
 * scripts/generate-bindings.ts
 *
 * Regenerates TypeScript bindings for the deployed AgentVault contract.
 * If called with --check flag, verifies that git diff on packages/vault-client is clean.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function main() {
  const isCheckMode = process.argv.includes('--check');
  const evidencePath = path.resolve('evidence', 'deployment.json');

  if (!fs.existsSync(evidencePath)) {
    throw new Error('evidence/deployment.json not found! Run deployment first.');
  }

  const deployment = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
  const vaultId = deployment.contracts.vault;
  if (!vaultId) {
    throw new Error('No vault contract ID found in evidence/deployment.json');
  }

  console.log(`Regenerating TypeScript bindings for Vault: ${vaultId}...`);
  execSync(
    `stellar contract bindings typescript --output-dir packages/vault-client --contract-id ${vaultId} --network testnet --overwrite`,
    { encoding: 'utf-8', stdio: 'inherit' }
  );

  // Ensure dependencies in packages/vault-client/package.json match root
  const pkgPath = path.resolve('packages', 'vault-client', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.dependencies = {
    ...pkg.dependencies,
    '@stellar/stellar-sdk': '^17.2.1',
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // Build the generated bindings
  console.log('Building packages/vault-client...');
  execSync('npm.cmd run build --workspace=packages/vault-client', { encoding: 'utf-8', stdio: 'inherit' });

  if (isCheckMode) {
    console.log('Checking for uncommitted changes in packages/vault-client...');
    const status = execSync('git status --porcelain packages/vault-client', { encoding: 'utf-8' }).trim();
    if (status) {
      console.error('❌ Error: packages/vault-client has uncommitted changes after bindings generation:');
      console.error(status);
      process.exit(1);
    }
    console.log('✅ Bindings are clean and up to date!');
  } else {
    console.log('✅ Bindings generated and built successfully!');
  }
}

main();
