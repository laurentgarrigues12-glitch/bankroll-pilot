import { beforeEach, describe, expect, it } from 'vitest';
import { bankrollService } from './bankrollService';
import { bankrollDatabase } from '../../infrastructure/storage/bankrollDatabase';

const heroTournament = { type: 'adjustment' as const, amountCents: 0, date: '2026-07-25', comment: 'Expresso Nitro Freeroll — 3e sur 3 — 5 mains', importKey: 'tournament:1155086037:hero' };

describe('bankrollService.importWinamaxOperations', () => {
  beforeEach(async () => {
    localStorage.setItem('bankroll-pilot.access.local.v1', JSON.stringify({ active: true }));
    for (const operation of await bankrollDatabase.getOperations()) await bankrollDatabase.deleteOperation(operation.id);
  });

  it('persists a zero-result tournament once and reports its reimport as a duplicate', async () => {
    await expect(bankrollService.importWinamaxOperations([heroTournament])).resolves.toEqual({ importedCount: 1, duplicateCount: 0 });
    expect(await bankrollDatabase.getOperations()).toEqual([expect.objectContaining({ id: 'winamax:tournament:1155086037:hero', amountCents: 0, type: 'adjustment', comment: heroTournament.comment })]);
    await expect(bankrollService.importWinamaxOperations([heroTournament])).resolves.toEqual({ importedCount: 0, duplicateCount: 1 });
    expect(await bankrollDatabase.getOperations()).toHaveLength(1);
  });

  it('keeps another player in the same tournament as a separate import', async () => {
    await bankrollService.importWinamaxOperations([heroTournament]);
    await expect(bankrollService.importWinamaxOperations([{ ...heroTournament, importKey: 'tournament:1155086037:player2' }])).resolves.toEqual({ importedCount: 1, duplicateCount: 0 });
    expect(await bankrollDatabase.getOperations()).toHaveLength(2);
  });
});
