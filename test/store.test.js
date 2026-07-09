import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTracked, saveTracked } from '../src/store.js';

test('loadTracked returns [] when file is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  try {
    assert.deepEqual(await loadTracked(join(dir, 'nope.json')), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('saveTracked then loadTracked round-trips items', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  const file = join(dir, 'tracked.json');
  try {
    const items = [{ ts: '1.2', status: 'active', expected: ['U1'] }];
    await saveTracked(file, items);
    assert.deepEqual(await loadTracked(file), items);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
