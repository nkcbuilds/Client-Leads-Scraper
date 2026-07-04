import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function main() {
  console.log('\n=== LegalReach Full Validation ===\n');

  console.log('Step 1: Unit tests (fixtures, no network)\n');
  await run('node', ['--test', 'test/**/*.test.js']);

  console.log('\nStep 2: Export format check\n');
  await run('node', ['src/scripts/validate-exports.js', '5']);

  console.log('\n=== ALL VALIDATION PASSED ===\n');
}

main().catch((err) => {
  console.error('\n=== VALIDATION FAILED ===');
  console.error(err.message);
  process.exit(1);
});