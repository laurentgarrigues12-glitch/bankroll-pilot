import { describe, expect, it } from 'vitest';
import { previewWinamaxFiles } from './previewWinamaxFiles';

const file = (name: string, content: string): File => {
  const item = new File([], name, { type: 'text/plain' });
  Object.defineProperty(item, 'text', { value: async () => content });
  return item;
};

describe('previewWinamaxFiles', () => {
  it('marks duplicate lines from selected files as warnings', async () => {
    const content = '2026-07-20;Dépôt;12,50;Recharge';
    const preview = await previewWinamaxFiles([file('first.csv', content), file('duplicate.csv', content)]);

    expect(preview.entries).toHaveLength(2);
    expect(preview.entries[0].status).toBe('valid');
    expect(preview.entries[1]).toMatchObject({ status: 'warning', message: 'Doublon dans les fichiers sélectionnés.' });
  });
});
