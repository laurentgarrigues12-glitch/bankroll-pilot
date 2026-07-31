import { describe, expect, it } from 'vitest';
import { isWinamaxImportedOperation, normalizeWinamaxOperation, winamaxSourceIdFor } from './winamaxOperation';

describe('Winamax operation identity', () => {
  it('recognizes and normalizes the legacy tournament source identity', () => {
    const legacy = { id: 'tournament:1155831676:maltau', type: 'adjustment' as const, amountCents: -1000, date: '2026-07-25', comment: 'Tournoi Winamax', createdAt: '', sourceId: 'tournament:1155831676:maltau' };

    expect(isWinamaxImportedOperation(legacy)).toBe(true);
    expect(winamaxSourceIdFor(legacy)).toBe('tournament:1155831676:maltau');
    expect(normalizeWinamaxOperation(legacy)).toMatchObject({ id: legacy.id, source: 'winamax', sourceId: 'tournament:1155831676:maltau' });
  });

  it('keeps a manual adjustment outside Winamax detection', () => {
    expect(isWinamaxImportedOperation({ id: 'manual-adjustment', type: 'adjustment', amountCents: 500, date: '2026-07-25', comment: '', createdAt: '' })).toBe(false);
  });
});
