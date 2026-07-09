import { readFile, writeFile, rename } from 'node:fs/promises';

export async function loadTracked(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function saveTracked(filePath, items) {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(items, null, 2));
  await rename(tmp, filePath);
}
