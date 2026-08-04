import type { ParsedWinamaxHand, WinamaxCurrency, WinamaxGameType, WinamaxParseError, WinamaxParseResult, WinamaxPlayerResult } from './types';

const cashHeader = /^Winamax Poker - CashGame - HandId: #?([\w-]+) - (.+?) \(([^/]+)\/([^)]+)\) - (.+)$/im;

const normalize = (value: string): string => value.replace(/\r\n/g, '\n').replace(/[\u00a0\u202f]/g, ' ').trim();

const fingerprint = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `wmx-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const parseAmount = (source: string): { amount: number; currency: WinamaxCurrency } | null => {
  const match = source.replace(/[\u00a0\u202f]/g, ' ').match(/(-?[\d\s.,]+)\s*([€$])/);
  if (match === null) return null;
  const compact = match[1].replace(/\s/g, '');
  const decimalSeparator = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  const normalizedNumber = decimalSeparator >= 0
    ? `${compact.slice(0, decimalSeparator).replace(/[,.]/g, '')}.${compact.slice(decimalSeparator + 1)}`
    : compact.replace(/[,.]/g, '');
  const amount = Number(normalizedNumber);
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: match[2] === '€' ? 'EUR' : 'USD' };
};

const parsePlayedAt = (source: string): string | null => {
  const match = source.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*(UTC)?/);
  if (match === null) return null;
  const [, year, month, day, hour, minute, second, isUtc] = match;
  const date = isUtc === 'UTC'
    ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
    : new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const error = (code: WinamaxParseError['code'], message: string, blockIndex: number, handId?: string): WinamaxParseError => ({ code, message, blockIndex, handId });

const splitHands = (content: string): string[] => {
  const normalizedContent = normalize(content);
  const starts = [...normalizedContent.matchAll(/^Winamax Poker - CashGame - HandId:/gim)].map((match) => match.index ?? 0);
  if (starts.length === 0) return normalizedContent === '' ? [] : [normalizedContent];
  return starts.map((start, index) => normalizedContent.slice(start, starts[index + 1]).trim());
};

const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePlayerResult = (block: string, mainPlayer: string, currency: WinamaxCurrency): WinamaxPlayerResult | null => {
  const playerExpression = escaped(mainPlayer);
  const actionLines = block.split('\n').filter((line) => new RegExp(`^${playerExpression}\\s+(?:posts|calls|bets|raises)`, 'i').test(line));
  const investedAmount = actionLines.reduce((total, line) => {
    const amounts = [...line.matchAll(/(-?[\d\s.,]+)\s*[€$]/g)].map((match) => parseAmount(`${match[0].trim()}${currency === 'EUR' ? '€' : '$'}`)?.amount ?? 0);
    return total + (amounts.at(-1) ?? 0);
  }, 0);
  const collected = [...block.matchAll(new RegExp(`^${playerExpression} collected (.+?) from pot`, 'gim'))]
    .reduce((total, match) => total + (parseAmount(match[1])?.amount ?? 0), 0);
  const summaryWin = new RegExp(`Seat \\d+: ${playerExpression} .*? and won \\(([^)]+)\\)`, 'i').exec(block);
  const recoveredAmount = collected > 0 ? collected : parseAmount(summaryWin?.[1] ?? '')?.amount ?? 0;
  return { playerName: mainPlayer, investedAmount: roundMoney(investedAmount), recoveredAmount: roundMoney(recoveredAmount), netResult: roundMoney(recoveredAmount - investedAmount) };
};

const parseBlock = (block: string, blockIndex: number): { hand?: ParsedWinamaxHand; errors: WinamaxParseError[] } => {
  const header = cashHeader.exec(block);
  if (header === null) {
    const partialHandId = /HandId:\s*#?([\w-]+)/i.exec(block)?.[1];
    return { errors: [error(block.startsWith('Winamax Poker - CashGame') ? 'INCOMPLETE_HAND' : 'UNSUPPORTED_FORMAT', 'En-tête CashGame Winamax incomplet ou non reconnu.', blockIndex, partialHandId)] };
  }
  const [, handId, gameName, smallBlindSource, bigBlindSource, dateSource] = header;
  if (gameName.toLowerCase() !== 'holdem no limit') return { errors: [error('UNSUPPORTED_GAME', 'Seul le cash game Holdem no limit est pris en charge.', blockIndex, handId)] };
  const smallBlind = parseAmount(smallBlindSource);
  const bigBlind = parseAmount(bigBlindSource);
  if (smallBlind === null || bigBlind === null || smallBlind.currency !== bigBlind.currency) return { errors: [error('INVALID_AMOUNT', 'Les blindes ne sont pas lisibles.', blockIndex, handId)] };
  const playedAt = parsePlayedAt(dateSource);
  const tableName = /^Table:\s+['"]([^'"]+)['"]/im.exec(block)?.[1];
  if (playedAt === null || tableName === undefined) return { errors: [error('INCOMPLETE_HAND', 'La date ou la table est absente de la main.', blockIndex, handId)] };
  const mainPlayer = /^Dealt to (.+?) \[/im.exec(block)?.[1] ?? /^(.+?) posts (?:small|big) blind/im.exec(block)?.[1];
  if (mainPlayer === undefined) return { errors: [error('PLAYER_NOT_DETECTED', 'Le joueur principal est introuvable.', blockIndex, handId)] };
  const gameType: WinamaxGameType = 'HOLDEM_NO_LIMIT';
  const playerResult = parsePlayerResult(block, mainPlayer, smallBlind.currency);
  return { hand: { handId, playedAt, tableName, gameType, currency: smallBlind.currency, smallBlind: smallBlind.amount, bigBlind: bigBlind.amount, mainPlayer, playerResult: playerResult ?? undefined, fingerprint: fingerprint(normalize(block)) }, errors: [] };
};

export const parseWinamaxHandHistory = (content: string): WinamaxParseResult => {
  const blocks = splitHands(content);
  const results = blocks.map((block, index) => parseBlock(block, index));
  return { hands: results.flatMap((result) => result.hand === undefined ? [] : [result.hand]), errors: results.flatMap((result) => result.errors), detectedBlockCount: blocks.length };
};
