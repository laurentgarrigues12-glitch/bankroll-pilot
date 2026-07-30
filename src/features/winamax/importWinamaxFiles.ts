import { parseWinamaxHandHistory } from '../../domain/winamax/winamaxHandHistoryParser';
import type { WinamaxImportSummary, WinamaxParseError } from '../../domain/winamax/types';

const isTextHistory = (file: File): boolean => file.name.toLowerCase().endsWith('.txt');

export const importWinamaxFiles = async (files: File[]): Promise<WinamaxImportSummary> => {
  const selectedFiles = files.filter(isTextHistory);
  const knownHands = new Set<string>();
  const errors: WinamaxParseError[] = [];
  let detectedBlockCount = 0;
  let validHandCount = 0;
  let duplicateCount = 0;
  let netResultTotal = 0;
  for (const file of selectedFiles) {
    const parsed = parseWinamaxHandHistory(await file.text());
    detectedBlockCount += parsed.detectedBlockCount;
    errors.push(...parsed.errors.map((parseError) => ({ ...parseError, fileName: file.name })));
    for (const hand of parsed.hands) {
      const uniqueKey = hand.handId || hand.fingerprint;
      if (knownHands.has(uniqueKey)) { duplicateCount += 1; continue; }
      knownHands.add(uniqueKey);
      validHandCount += 1;
      netResultTotal = Math.round((netResultTotal + (hand.playerResult?.netResult ?? 0) + Number.EPSILON) * 100) / 100;
    }
  }
  return { fileCount: selectedFiles.length, detectedBlockCount, validHandCount, duplicateCount, errorCount: errors.length, netResultTotal, errors };
};
