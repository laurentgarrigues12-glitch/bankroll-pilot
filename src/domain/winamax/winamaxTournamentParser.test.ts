import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeWinamaxTournaments, parseWinamaxTournamentFile } from './winamaxTournamentParser';

const fixture = (name: string): string => readFileSync(resolve(process.cwd(), 'src/domain/winamax/fixtures', name), 'utf8');
const mainName = 'expresso_nitro_freeroll_real_holdem_no-limit.txt';
const summaryName = 'expresso_nitro_freeroll_real_holdem_no-limit_summary.txt';

describe('Winamax Expresso tournament parser', () => {
  it('parses and merges the anonymized five-hand freeroll', () => {
    const main = parseWinamaxTournamentFile(fixture(mainName), mainName);
    const summary = parseWinamaxTournamentFile(fixture(summaryName), summaryName);
    expect(main).toMatchObject({ tournamentId: '1155086037', tournamentName: 'Expresso Nitro Freeroll', playerName: 'Hero', handCount: 5, buyInCents: 0, feeCents: 0, netResultCents: 0 });
    expect(new Set(main?.handIds).size).toBe(5);
    expect(summary).toMatchObject({ tournamentId: '1155086037', playerName: 'Hero', durationSeconds: 134, finishingPosition: 3, registeredPlayers: 3, prizeCents: 0 });
    expect(mergeWinamaxTournaments([main!, summary!])).toMatchObject([{ handCount: 5, sourceFiles: [mainName, summaryName], netResultCents: 0 }]);
  });

  it('does not interpret a tournament header without an id as a tournament', () => {
    expect(parseWinamaxTournamentFile('Winamax Poker - Tournament "Test"', 'unknown.txt')).toBeNull();
  });
});
