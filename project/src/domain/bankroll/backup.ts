import { z } from 'zod';
import type { BankrollSettings, FinancialOperation, StoredHand } from './types';

export interface ImportRecord { id: string; importedAt: string; handCount: number; netResultCents: number; }
export interface BackupData { settings: BankrollSettings | null; operations: FinancialOperation[]; hands: StoredHand[]; imports: ImportRecord[]; }
export interface BankrollBackup { format: 'bankroll-pilot-backup'; version: 1; exportedAt: string; data: BackupData; }

const dateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date invalide.');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.').refine((value) => { const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; }, 'Date invalide.');
const cents = z.number().int('Le montant doit être un nombre entier de centimes.').nonnegative('Le montant ne peut pas être négatif.');
const playerResult = z.object({ playerName: z.string().min(1), investedAmount: z.number().finite(), recoveredAmount: z.number().finite(), netResult: z.number().finite() });
const hand = z.object({ handId: z.string().min(1), playedAt: dateString, tableName: z.string().min(1), gameType: z.literal('HOLDEM_NO_LIMIT'), currency: z.enum(['EUR', 'USD']), smallBlind: z.number().finite(), bigBlind: z.number().finite(), mainPlayer: z.string().optional(), playerResult: playerResult.optional(), fingerprint: z.string().min(1), netResultCents: z.number().int(), importedAt: dateString });
const operation = z.object({ id: z.string().min(1), type: z.enum(['deposit', 'withdrawal', 'expense', 'adjustment']), amountCents: z.number().int(), date: dateOnly, comment: z.string(), createdAt: dateString, source: z.string().optional(), sourceId: z.string().optional(), metadata: z.object({ source: z.string().optional(), sourceId: z.string().optional() }).optional() });
const importRecord = z.object({ id: z.string().min(1), importedAt: dateString, handCount: z.number().int().nonnegative(), netResultCents: z.number().int() });
const settings = z.object({ id: z.literal('current'), initialBankrollCents: cents, currency: z.literal('EUR'), startDate: dateOnly });

const backupSchema = z.object({ format: z.literal('bankroll-pilot-backup'), version: z.literal(1), exportedAt: dateString, data: z.object({ settings: settings.nullable(), operations: z.array(operation), hands: z.array(hand), imports: z.array(importRecord) }) }).superRefine((backup, context) => {
  const duplicates = (values: { id: string }[], path: string) => values.forEach((value, index) => { if (values.findIndex((item) => item.id === value.id) !== index) context.addIssue({ code: 'custom', path: ['data', path, index, 'id'], message: 'Identifiant dupliqué.' }); });
  duplicates(backup.data.operations, 'operations');
  duplicates(backup.data.hands.map((hand) => ({ id: hand.handId })), 'hands');
  duplicates(backup.data.imports, 'imports');
});

export const parseBankrollBackup = (value: unknown): BankrollBackup => {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Sauvegarde invalide.');
  return parsed.data as BankrollBackup;
};

export const backupFileName = (date = new Date()): string => `bankroll-pilot-backup-${date.toISOString().slice(0, 10)}.json`;
