import { describe, expect, it } from 'vitest';
import { importWinamaxFiles } from './importWinamaxFiles';

const hand = `Winamax Poker - CashGame - HandId: #200001 - Holdem no limit (0,05€/0,10€) - 2026/07/30 12:00:00 UTC
Table: 'Arabica' 6-max (real money)
Hero posts small blind 0,05€
Dealt to Hero [As Kd]
Hero collected 0,20€ from pot`;

const createFile = (name: string, content: string): File => {
  const file = new File([], name, { type: 'text/plain' });
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
};

describe('importWinamaxFiles', () => {
  it('filters non-text files, detects duplicates and produces a summary', async () => {
    const summary = await importWinamaxFiles([createFile('one.txt', hand), createFile('duplicate.txt', hand), createFile('ignored.csv', hand)]);
    expect(summary).toMatchObject({ fileCount: 2, detectedBlockCount: 2, validHandCount: 1, duplicateCount: 1, errorCount: 0, netResultTotal: 0.15 });
  });

  it('includes normalized file errors in the summary', async () => {
    const summary = await importWinamaxFiles([createFile('invalid.txt', 'unknown')]);
    expect(summary.errors[0]).toMatchObject({ code: 'UNSUPPORTED_FORMAT', fileName: 'invalid.txt' });
  });
});
