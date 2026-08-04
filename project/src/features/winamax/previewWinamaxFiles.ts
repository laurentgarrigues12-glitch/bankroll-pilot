import { toCalendarDate } from '../../domain/bankroll/calendarDate';
import { parseWinamaxPreview, type WinamaxPreviewEntry, type WinamaxPreviewFormat } from '../../domain/winamax/winamaxPreviewParser';
import { parseWinamaxTournamentFiles } from './parseWinamaxTournamentFiles';

export interface WinamaxFilePreview {
  name: string;
  size: number;
  lineCount: number;
  recognizedLineCount: number;
  ignoredLineCount: number;
  errors: string[];
  entries: WinamaxPreviewEntry[];
}

export interface WinamaxFilesPreview {
  files: WinamaxFilePreview[];
  entries: WinamaxPreviewEntry[];
  /** Source file names, aligned with entries. Kept in memory only for folder imports. */
  entrySourceFileNames: string[][];
  invalidFileNames: string[];
}

const formatForFile = (file: File): WinamaxPreviewFormat | null => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'txt' || extension === 'csv' ? extension : null;
};

export const previewWinamaxFiles = async (selectedFiles: File[]): Promise<WinamaxFilesPreview> => {
  const invalidFileNames: string[] = [];
  const files: WinamaxFilePreview[] = [];
  const rawTextFiles = await Promise.all(selectedFiles.filter((file) => formatForFile(file) === 'txt').map(async (file) => ({ name: file.name, content: await file.text() })));
  // Transmettre tous les fichiers texte au parseur de tournois.
  // Certains fichiers summary Winamax ne contiennent pas exactement
  // l'en-tête « Winamax Poker - Tournament » et étaient donc exclus
  // avant l'association avec leur fichier d'historique.
  const parsedTournaments = parseWinamaxTournamentFiles(rawTextFiles);
  const tournamentEntries: WinamaxPreviewEntry[] = parsedTournaments.tournaments.map((tournament) => {
    const hasSummary = tournament.sourceFiles.some((name) => /_summary\.txt$/i.test(name));
    const hasHistory = tournament.handCount > 0;
    const message = !hasSummary ? 'Le fichier summary du tournoi est manquant.' : !hasHistory ? 'L’historique de mains du tournoi est manquant.' : 'Tournoi importable.';
    return { kind: 'tournament', tournamentId: tournament.tournamentId, playerName: tournament.playerName, handCount: tournament.handCount, buyInCents: tournament.buyInCents, feeCents: tournament.feeCents, finishingPosition: tournament.finishingPosition, registeredPlayers: tournament.registeredPlayers, date: toCalendarDate(tournament.startedAt), detectedType: tournament.tournamentName, amountCents: tournament.netResultCents, originalDescription: `${tournament.tournamentName} — ${tournament.finishingPosition ?? '?'}e sur ${tournament.registeredPlayers ?? '?'} — ${tournament.handCount} mains`, status: hasSummary && hasHistory ? 'valid' : 'error', message };
  });

  for (const file of selectedFiles) {
    const format = formatForFile(file);
    if (format === null) {
      invalidFileNames.push(file.name);
      continue;
    }

    const tournament = parsedTournaments.tournaments.find((item) => item.sourceFiles.includes(file.name));
    if (tournament !== undefined) { files.push({ name: file.name, size: file.size, lineCount: tournament.handCount, recognizedLineCount: tournament.handCount, ignoredLineCount: 0, entries: [], errors: [] }); continue; }

    try {
      const result = parseWinamaxPreview(await file.text(), format);
      files.push({ name: file.name, size: file.size, ...result });
    } catch {
      files.push({ name: file.name, size: file.size, lineCount: 0, recognizedLineCount: 0, ignoredLineCount: 0, entries: [], errors: ['Lecture du fichier impossible.'] });
    }
  }

  const seenLines = new Set<string>();
  files.forEach((file) => file.entries.forEach((entry) => {
    if (entry.status === 'error') return;
    const key = entry.originalDescription.toLocaleLowerCase();
    if (seenLines.has(key)) {
      entry.status = 'warning';
      entry.message = 'Doublon dans les fichiers sélectionnés.';
      return;
    }
    seenLines.add(key);
  }));

  const fileEntries = files.flatMap((file) => file.entries);
  return {
    files,
    entries: [...fileEntries, ...tournamentEntries],
    entrySourceFileNames: [...files.flatMap((file) => file.entries.map(() => [file.name])), ...parsedTournaments.tournaments.map((tournament) => tournament.sourceFiles)],
    invalidFileNames,
  };
};
