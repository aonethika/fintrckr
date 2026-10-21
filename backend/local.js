import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Use a real WiredTiger database on disk; retain all data when the process stops.
const directory = fileURLToPath(new URL('../.local-data/', import.meta.url));
const dbPath = path.join(directory, 'mongodb');
await mkdir(dbPath, { recursive: true });
const secretPath = path.join(directory, 'jwt-secret');
let secret;
try { secret = await readFile(secretPath, 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  secret = randomBytes(48).toString('hex');
  await writeFile(secretPath, secret, { flag: 'wx', mode: 0o600 });
}
const mongo = await MongoMemoryReplSet.create({
  instanceOpts: [{ dbPath, port: 27018, ip: '127.0.0.1', storageEngine: 'wiredTiger' }],
  replSet: { name: 'finsight-local', count: 1, storageEngine: 'wiredTiger' },
});
process.env.MONGO_URI = mongo.getUri('finsight');
process.env.JWT_SECRET = secret;
process.env.PORT = process.env.FINSIGHT_LOCAL_API_PORT || '5050';
process.env.HOST = '127.0.0.1';
console.log(`Local Finsight data is stored persistently in ${dbPath}`);
await import('./server.js');
if (process.exitCode) await mongo.stop({ doCleanup: false });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await mongo.stop({ doCleanup: false });
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
