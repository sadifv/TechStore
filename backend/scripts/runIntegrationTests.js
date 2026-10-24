const { spawn } = require('node:child_process');
const path = require('node:path');
const child = spawn(
  process.execPath,
  ['--test', ...process.argv.slice(2), 'tests/orderTransactions.integration.test.js', 'tests/ownerRoles.integration.test.js'],
  {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, TECHSTORE_INTEGRATION: '1' },
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
