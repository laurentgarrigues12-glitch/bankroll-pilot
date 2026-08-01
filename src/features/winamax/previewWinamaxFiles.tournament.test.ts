import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewWinamaxFiles } from './previewWinamaxFiles';

const text = (name: string): string => readFileSync(resolve(process.cwd(), 'src/domain/winamax/fixtures', name), 'utf8');
const main = 'expresso_nitro_freeroll_real_holdem_no-limit.txt';
const summary = 'expresso_nitro_freeroll_real_holdem_no-limit_summary.txt';
const file = (name: string): File => new File([text(name)], name, { type: 'text/plain' });

describe('previewWinamaxFiles tournament histories', () => {
  it('groups main history and summary into one importable zero-result tournament', async () => {
    const preview = await previewWinamaxFiles([file(main), file(summary)]);
    expect(preview.entries).toMatchObject([{ kind: 'tournament', tournamentId: '1155086037', playerName: 'Hero', handCount: 5, buyInCents: 0, amountCents: 0, finishingPosition: 3, registeredPlayers: 3, status: 'valid' }]);
    expect(preview.files.map((item) => [item.recognizedLineCount, item.ignoredLineCount])).toEqual([[5, 0], [5, 0]]);
  });

  it('keeps an orphan history previewable but non-importable', async () => {
    const preview = await previewWinamaxFiles([file(main)]);
    expect(preview.entries).toMatchObject([{ kind: 'tournament', handCount: 5, status: 'error', message: 'Le fichier summary du tournoi est manquant.' }]);
  });

  it('keeps a summary alone previewable but non-importable', async () => {
    const preview = await previewWinamaxFiles([file(summary)]);
    expect(preview.entries).toMatchObject([{ kind: 'tournament', tournamentId: '1155086037', playerName: 'Hero', handCount: 0, buyInCents: 0, finishingPosition: 3, registeredPlayers: 3, status: 'error', message: 'L’historique de mains du tournoi est manquant.' }]);
  });

  it('is independent from file ordering and does not merge incompatible identifiers', async () => {
    const reverse = await previewWinamaxFiles([file(summary), file(main)]);
    expect(reverse.entries).toHaveLength(1);
    expect(reverse.entries[0]).toMatchObject({ status: 'valid', handCount: 5, tournamentId: '1155086037' });
    const incompatible = new File([text(summary).replace('1155086037', '1155086038')], summary);
    const preview = await previewWinamaxFiles([file(main), incompatible]);
    expect(preview.entries).toHaveLength(2);
    expect(preview.entries.map((entry) => entry.status)).toEqual(['error', 'error']);
  });

  it('uses the local calendar date for a UTC tournament timestamp', async () => {
    const startedAt = '2026-07-31T23:30:00.000Z';
    const history = `Winamax Poker - Tournament "Expresso Nitro" buyIn: 0.23€ + 0.02€ level: 1 - HandId: #1234567890123456789-1-1 - Holdem no limit (10/20) - 2026/07/31 23:30:00 UTC
Dealt to Hero [As Kd]`;
    const summaryContent = `Winamax Poker - Tournament summary : Expresso Nitro(1234567890)
Player : Hero
Buy-In : 0.23€ + 0.02€
Registered players : 3
Tournament started 2026/07/31 23:30:00 UTC
You finished in 2nd place`;
    const preview = await previewWinamaxFiles([
      new File([history], 'expresso(1234567890).txt'),
      new File([summaryContent], 'expresso(1234567890)_summary.txt'),
    ]);

    const expected = new Date(startedAt);
    const localDate = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
    expect(preview.entries[0]).toMatchObject({ date: localDate });
  });

  it('keeps CSV parsing unchanged', async () => {
    const preview = await previewWinamaxFiles([new File(['2026-07-20;Dépôt;12,50'], 'transactions.csv')]);
    expect(preview.entries[0]).toMatchObject({ detectedType: 'Dépôt', amountCents: 1250 });
  });
});
