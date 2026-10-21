import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node configure-ai.js path/to/original/backend/.env');
const source = dotenv.parse(await readFile(sourcePath, 'utf8'));
if (!source.EXPLABS_API_KEY) throw new Error('The source has no EXPLABS_API_KEY.');
const directory = fileURLToPath(new URL('../.local-data/', import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(new URL('../.local-data/ai.env', import.meta.url), `EXPLABS_API_KEY=${JSON.stringify(source.EXPLABS_API_KEY)}\nFINSIGHT_AI_BASE_URL=https://api.experientiallabs.ai/v1\nFINSIGHT_AI_MODEL=gpt-6-astra\n`, { flag: 'wx', mode: 0o600 });
console.log('Original Finsight AI provider configured. Credentials remain in the ignored local-data directory.');
