import { mergeWinamaxTournaments, parseWinamaxTournamentFile, type ParsedWinamaxTournament } from '../../domain/winamax/winamaxTournamentParser';

export interface TournamentSourceFile { name: string; content: string; }
export interface TournamentFilesResult { tournaments: ParsedWinamaxTournament[]; orphanFiles: string[]; }

export const parseWinamaxTournamentFiles = (files: TournamentSourceFile[]): TournamentFilesResult => {
  const parsed = files.map((file) => ({ file, tournament: parseWinamaxTournamentFile(file.content, file.name) }));
  return { tournaments: mergeWinamaxTournaments(parsed.flatMap(({ tournament }) => tournament === null ? [] : [tournament])), orphanFiles: parsed.flatMap(({ file, tournament }) => tournament === null ? [file.name] : []) };
};
