import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export function aiConfig() {
  const localFile = fileURLToPath(new URL('../../.local-data/ai.env', import.meta.url));
  const local = existsSync(localFile) ? dotenv.parse(readFileSync(localFile)) : {};
  const value = key => process.env[key] || local[key];
  const labs = value('EXPLABS_API_KEY');
  const key = value('FINSIGHT_AI_API_KEY') || labs || value('OPENAI_API_KEY');
  const baseURL = (value('FINSIGHT_AI_BASE_URL') || (labs ? 'https://api.experientiallabs.ai/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
  const model = value('FINSIGHT_AI_MODEL') || (labs ? 'gpt-6-astra' : '');
  return { key, baseURL, model, provider: new URL(baseURL).hostname, configured: Boolean(key && model) };
}
