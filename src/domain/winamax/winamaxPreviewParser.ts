export type WinamaxPreviewFormat = 'txt' | 'csv';
export type WinamaxPreviewStatus = 'valid' | 'warning' | 'error';

export interface WinamaxPreviewEntry {
  kind?: 'financial' | 'tournament';
  tournamentId?: string;
  playerName?: string;
  handCount?: number;
  buyInCents?: number;
  finishingPosition?: number;
  registeredPlayers?: number;
  date?: string;
  detectedType: string;
  amountCents?: number;
  originalDescription: string;
  status: WinamaxPreviewStatus;
  message: string;
}

export interface WinamaxPreviewParseResult {
  lineCount: number;
  recognizedLineCount: number;
  ignoredLineCount: number;
  entries: WinamaxPreviewEntry[];
  errors: string[];
}

const knownTypes = [
  { expression: /\b(dépôt|depot|deposit)\b/i, label: 'Dépôt' },
  { expression: /\b(retrait|withdrawal|cashout)\b/i, label: 'Retrait' },
  { expression: /\b(cashgame|cash game|holdem)\b/i, label: 'Cash game' },
];

const parseAmount = (value: string): { amountCents?: number; issue?: string } => {
  if (/^(?:\d{4}[-/]\d{2}[-/]\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(value.trim())) return { issue: 'Montant absent.' };
  const match = value.match(/(?:^|[^\d])(\d+(?:[,.]\d+)?)(?:\s*[€$])?(?:$|[^\d])/);
  if (match === null) return { issue: 'Montant absent.' };

  const normalized = match[1].replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { issue: 'Montant invalide.' };

  const amountCents = Math.round(Number(normalized) * 100);
  return amountCents === 0 ? { issue: 'Le montant doit être supérieur à zéro.' } : { amountCents };
};

const parseDate = (value: string): { date?: string; issue?: string } => {
  const iso = value.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
  const french = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (iso === null && french === null) return { issue: 'Date absente.' };

  const [, year, month, day] = iso ?? [undefined, french?.[3], french?.[2], french?.[1]];
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) return { issue: 'Date invalide.' };

  return { date: `${year}-${month}-${day}` };
};

const parseLine = (line: string, format: WinamaxPreviewFormat): WinamaxPreviewEntry => {
  if (line.trim() === '') return { detectedType: 'Inconnu', originalDescription: line, status: 'error', message: 'Ligne vide.' };

  const columns = format === 'csv' ? line.split(line.includes(';') ? ';' : ',').map((column) => column.trim()) : [line];
  const dates = columns.map(parseDate);
  const amounts = columns.map(parseAmount);
  const date = dates.find((candidate) => candidate.date !== undefined) ?? dates.find((candidate) => candidate.issue !== 'Date absente.') ?? parseDate(line);
  const amount = amounts.find((candidate) => candidate.amountCents !== undefined) ?? amounts.find((candidate) => candidate.issue !== 'Montant absent.') ?? parseAmount(line);
  const knownType = knownTypes.find(({ expression }) => expression.test(line));

  if (date.issue !== undefined) return { detectedType: knownType?.label ?? 'Inconnu', originalDescription: line.trim(), status: 'error', message: date.issue };
  if (amount.issue !== undefined) return { date: date.date, detectedType: knownType?.label ?? 'Inconnu', originalDescription: line.trim(), status: 'error', message: amount.issue };
  if (knownType === undefined) return { date: date.date, amountCents: amount.amountCents, detectedType: 'Inconnu', originalDescription: line.trim(), status: 'warning', message: 'Type inconnu.' };

  return { date: date.date, amountCents: amount.amountCents, detectedType: knownType.label, originalDescription: line.trim(), status: 'valid', message: 'Ligne valide.' };
};

export const parseWinamaxPreview = (content: string, format: WinamaxPreviewFormat): WinamaxPreviewParseResult => {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();

  const entries = lines.map((line) => parseLine(line, format));
  const recognizedLineCount = entries.filter((entry) => entry.status !== 'error').length;
  const errors = entries.filter((entry) => entry.status === 'error').map((entry) => entry.message);

  return { lineCount: lines.length, recognizedLineCount, ignoredLineCount: entries.filter((entry) => entry.status === 'error').length, entries, errors };
};
