import type { WinamaxOperationImport } from '../../application/bankroll/bankrollService';
import type { FinancialOperationType } from '../../domain/bankroll/types';
import type { WinamaxPreviewEntry } from '../../domain/winamax/winamaxPreviewParser';

const hash = (value: string): string => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
};

const operationTypeFor = (detectedType: string): FinancialOperationType => {
  if (detectedType === 'Dépôt') return 'deposit';
  if (detectedType === 'Retrait') return 'withdrawal';
  return 'adjustment';
};

const isImportable = (entry: WinamaxPreviewEntry): entry is WinamaxPreviewEntry & { date: string; amountCents: number } => entry.status !== 'error' && entry.date !== undefined && entry.amountCents !== undefined;

export const toWinamaxOperationImports = (entries: WinamaxPreviewEntry[]): WinamaxOperationImport[] => entries
  .filter(isImportable)
  .map((entry) => {
    if (entry.kind === 'tournament' && entry.tournamentId !== undefined && entry.playerName !== undefined) {
      const player = entry.playerName.trim().toLocaleLowerCase().replace(/\s+/g, '-');
      return { type: 'adjustment', amountCents: entry.amountCents, date: entry.date, comment: entry.originalDescription, importKey: `tournament:${entry.tournamentId}:${player}` };
    }
    const source = `winamax|${entry.date}|${entry.detectedType}|${entry.amountCents}|${entry.originalDescription.trim()}`;
    return { type: operationTypeFor(entry.detectedType), amountCents: entry.amountCents, date: entry.date, comment: entry.originalDescription, importKey: hash(source) };
  });
