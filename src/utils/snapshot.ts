import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Save a JSON snapshot to data/output/{runId}/{filename}.
 * Creates directories as needed.
 */
export async function saveSnapshot(
  baseDir: string,
  runId: string,
  filename: string,
  data: unknown,
): Promise<string> {
  const dir = path.join(baseDir, runId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

/**
 * Load a JSON snapshot from data/output/{runId}/{filename}.
 * Returns null if the file does not exist.
 */
export async function loadSnapshot<T = unknown>(
  baseDir: string,
  runId: string,
  filename: string,
): Promise<T | null> {
  const filePath = path.join(baseDir, runId, filename);
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
