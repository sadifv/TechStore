const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongoose').mongo;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startLocalReplicaSet() {
  const dbPath = await fs.mkdtemp(path.join(os.tmpdir(), 'techstore-replset-'));
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
  const binary = process.env.MONGOD_BINARY || (process.platform === 'win32' ? 'C:/Program Files/MongoDB/Server/9.0/bin/mongod.exe' : 'mongod');
  const child = spawn(binary, ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'techstoreTest', '--logpath', path.join(dbPath, 'mongod.log')], { stdio: 'ignore', windowsHide: true });
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 400 });
  const stop = async () => {
    await client.close();
    if (child.exitCode === null && !spawnError) {
      child.kill();
      await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(5000)]);
      if (child.exitCode === null && child.signalCode === null) throw new Error('Mongo temporal sigue activo; no se elimina su dbPath.');
    }
    const actual = await fs.realpath(dbPath);
    const parent = await fs.realpath(os.tmpdir());
    if (path.dirname(actual).toLowerCase() !== parent.toLowerCase() || !path.basename(actual).startsWith('techstore-replset-')) throw new Error('dbPath fuera del directorio temporal esperado.');
    await fs.rm(actual, { recursive: true, force: true });
  };
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      if (spawnError) throw spawnError;
      try { await client.connect(); break; } catch (error) { if (Date.now() >= deadline) throw error; await sleep(150); }
    }
    await client.db('admin').command({ replSetInitiate: { _id: 'techstoreTest', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    while (!(await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
      if (Date.now() >= deadline) throw new Error('Replica set no alcanzó PRIMARY.');
      await sleep(150);
    }
    return { uri: `mongodb://127.0.0.1:${port}/techstore_test?replicaSet=techstoreTest`, stop };
  } catch (error) { await stop(); throw error; }
}
module.exports = { startLocalReplicaSet };
