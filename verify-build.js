const { execSync } = require('child_process');
const fs = require('fs');

const commands = [
  { name: 'BUILD', cmd: 'npx next build' },
  { name: 'TYPECHECK', cmd: 'npx tsc --noEmit' },
  { name: 'LINT', cmd: 'npx next lint' },
];

let output = '';
let allPassed = true;

for (const { name, cmd } of commands) {
  output += `\n=== ${name} ===\n`;
  try {
    const result = execSync(cmd, {
      cwd: 'c:\\midlink',
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      timeout: 120000,
    });
    output += result + '\n';
    output += `✅ ${name} PASSED\n`;
  } catch (e) {
    allPassed = false;
    output += (e.stdout || '') + '\n';
    output += (e.stderr || '') + '\n';
    output += `❌ ${name} FAILED (exit code: ${e.status})\n`;
  }
}

output += `\n=== SUMMARY ===\n`;
output += allPassed ? '✅ ALL CHECKS PASSED\n' : '❌ SOME CHECKS FAILED\n';

fs.writeFileSync('c:\\midlink\\verify-results.txt', output, 'utf8');
console.log('Results written to verify-results.txt');
