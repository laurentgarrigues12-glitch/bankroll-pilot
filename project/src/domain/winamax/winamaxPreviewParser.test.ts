import { describe, expect, it } from 'vitest';
import { parseWinamaxPreview } from './winamaxPreviewParser';

describe('parseWinamaxPreview', () => {
  it('parses a valid line and counts the other lines as errors', () => {
    const result = parseWinamaxPreview('Date;Type;Montant;Description\n2026-07-20;Dépôt;12,50;Recharge Winamax\nligne inconnue', 'csv');

    expect(result).toMatchObject({ lineCount: 3, recognizedLineCount: 1, ignoredLineCount: 2 });
    expect(result.entries[1]).toMatchObject({ date: '2026-07-20', detectedType: 'Dépôt', amountCents: 1250, status: 'valid' });
  });

  it.each([
    ['2026-99-20;Dépôt;12,50', 'Date invalide.'],
    ['2026-07-20;Dépôt;12.999', 'Montant invalide.'],
    ['2026-07-20;Dépôt;0', 'Le montant doit être supérieur à zéro.'],
    ['', 'Ligne vide.'],
  ])('marks invalid input as an error: %s', (line, message) => {
    const result = parseWinamaxPreview(line, 'csv');

    expect(result.entries[0]).toMatchObject({ status: 'error', message });
  });

  it('keeps an unknown type as an importable warning', () => {
    const result = parseWinamaxPreview('2026-07-20;Mystère;12,50;Description', 'csv');

    expect(result.entries[0]).toMatchObject({ status: 'warning', message: 'Type inconnu.', amountCents: 1250 });
  });
});
