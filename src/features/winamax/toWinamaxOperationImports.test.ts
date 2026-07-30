import { describe, expect, it } from 'vitest';
import { toWinamaxOperationImports } from './toWinamaxOperationImports';

describe('toWinamaxOperationImports', () => {
  it('keeps cents, date and source description while producing a stable key', () => {
    const entry = { date: '2026-07-20', detectedType: 'Dépôt', amountCents: 1250, originalDescription: '2026-07-20;Dépôt;12,50;Recharge', status: 'valid' as const, message: 'Ligne valide.' };

    expect(toWinamaxOperationImports([entry])).toEqual([{ type: 'deposit', amountCents: 1250, date: '2026-07-20', comment: '2026-07-20;Dépôt;12,50;Recharge', importKey: expect.any(String) }]);
    expect(toWinamaxOperationImports([entry])[0].importKey).toBe(toWinamaxOperationImports([entry])[0].importKey);
  });

  it('excludes rows in error and maps confirmed warnings to adjustments', () => {
    const entries = [
      { detectedType: 'Dépôt', originalDescription: 'bad', status: 'error' as const, message: 'Date absente.' },
      { date: '2026-07-20', detectedType: 'Inconnu', amountCents: 500, originalDescription: 'unknown', status: 'warning' as const, message: 'Type inconnu.' },
    ];

    expect(toWinamaxOperationImports(entries)).toEqual([{ type: 'adjustment', amountCents: 500, date: '2026-07-20', comment: 'unknown', importKey: expect.any(String) }]);
  });

  it('converts one complete tournament with a zero result into one stable adjustment', () => {
    const entry = { kind: 'tournament' as const, tournamentId: '1155086037', playerName: 'Hero', handCount: 5, date: '2026-07-25', detectedType: 'Expresso Nitro Freeroll', amountCents: 0, originalDescription: 'Expresso Nitro Freeroll — 3e sur 3 — 5 mains', status: 'valid' as const, message: 'Tournoi importable.' };
    expect(toWinamaxOperationImports([entry])).toEqual([{ type: 'adjustment', amountCents: 0, date: '2026-07-25', comment: 'Expresso Nitro Freeroll — 3e sur 3 — 5 mains', importKey: 'tournament:1155086037:hero' }]);
    expect(toWinamaxOperationImports([{ ...entry, status: 'error' as const }])).toEqual([]);
  });
});
