import { describe, expect, it } from 'vitest';
import { parseWinamaxHandHistory } from './winamaxHandHistoryParser';

const winningHand = `Winamax Poker - CashGame - HandId: #100001 - Holdem no limit (0,05€/0,10€) - 2026/07/30 12:00:00 UTC
Table: 'Cappuccino' 6-max (real money)
Dealer: seat 1
Hero posts small blind 0,05€
Villain posts big blind 0,10€
Dealt to Hero [As Kd]
Hero calls 0,05€
Hero collected 0,30€ from pot
Summary
Seat 1: Hero showed [As Kd] and won (0,30€)`;

const losingHand = `Winamax Poker - CashGame - HandId: #100002 - Holdem no limit (0.05€/0.10€) - 2026/07/30 13:00:00 UTC
Table: 'Mocha' 6-max (real money)
Hero posts big blind 0.10€
Dealt to Hero [Qs Jh]
Hero calls 0.20€
Summary
Seat 1: Hero mucked`;

describe('parseWinamaxHandHistory', () => {
  it('parses a winning cash game hand with comma amounts', () => {
    const result = parseWinamaxHandHistory(winningHand);
    expect(result.errors).toEqual([]);
    expect(result.hands[0]).toMatchObject({ handId: '100001', tableName: 'Cappuccino', currency: 'EUR', smallBlind: 0.05, bigBlind: 0.1, mainPlayer: 'Hero' });
    expect(result.hands[0].playerResult).toMatchObject({ investedAmount: 0.1, recoveredAmount: 0.3, netResult: 0.2 });
  });

  it('calculates a losing hand from invested chips', () => {
    const result = parseWinamaxHandHistory(losingHand);
    expect(result.hands[0].playerResult?.netResult).toBe(-0.3);
  });

  it('separates multiple hands and rejects incomplete or unknown blocks without stopping', () => {
    const result = parseWinamaxHandHistory(`${winningHand}\n\n${losingHand}\n\nWinamax Poker - CashGame - HandId: #100003 - Holdem no limit (0,05€/0,10€)`);
    expect(result.detectedBlockCount).toBe(3);
    expect(result.hands).toHaveLength(2);
    expect(result.errors[0].code).toBe('INCOMPLETE_HAND');
  });

  it('returns a normalized error for an unknown format', () => {
    const result = parseWinamaxHandHistory('Tournament Hand #123 — unknown format');
    expect(result.hands).toEqual([]);
    expect(result.errors[0].code).toBe('UNSUPPORTED_FORMAT');
  });
});
