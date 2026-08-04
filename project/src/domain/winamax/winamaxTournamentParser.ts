export interface ParsedWinamaxTournament {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  startedAt: string;
  durationSeconds?: number;
  buyInCents: number;
  feeCents: number;
  prizeCents: number;
  netResultCents: number;
  finishingPosition?: number;
  registeredPlayers?: number;
  gameMode?: string;
  gameType?: string;
  speed?: string;
  handCount: number;
  handIds: string[];
  sourceFiles: string[];
}

const cents = (value: string | undefined): number => {
  const number = Number(
    (value ?? '0')
      .replace(',', '.')
      .replace(/[^\d.]/g, ''),
  );

  return Number.isFinite(number)
    ? Math.round(number * 100)
    : 0;
};

const field = (
  source: string,
  label: string,
): string | undefined =>
  new RegExp(`^${label}\\s*:?[ \\t]*(.+)$`, 'im')
    .exec(source)?.[1]
    ?.trim();

const idFrom = (source: string): string | undefined =>
  /(?:summary\s*:\s*[^\n]*|Table:\s*'[^']*)\((\d{6,})\)/i
    .exec(source)?.[1] ??
  /\((\d{6,})\)/
    .exec(source)?.[1];

export const parseWinamaxTournamentFile = (
  content: string,
  sourceFile: string,
): ParsedWinamaxTournament | null => {
  const tournamentId = idFrom(`${sourceFile}\n${content}`);

  if (tournamentId === undefined) {
    return null;
  }

  const headers = [
    ...content.matchAll(
      /^Winamax Poker - Tournament\s+"([^"]+)".*?HandId:\s*#?(\S+).*?-\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s*UTC/gim,
    ),
  ];

  const title =
    headers[0]?.[1] ??
    /Tournament summary\s*:\s*([^\n(]+)/i
      .exec(content)?.[1]
      ?.trim() ??
    field(content, 'Tournament') ??
    sourceFile.replace(/_summary|\.txt$/gi, '');

  const player =
    /^Dealt to\s+(.+?)\s*\[/im.exec(content)?.[1] ??
    field(content, 'Player') ??
    'Unknown player';

  const start =
    headers[0]?.[3] ??
    field(content, 'Tournament started') ??
    '';

  const startedAt =
    start === ''
      ? ''
      : new Date(
          `${start
            .replace(/\//g, '-')
            .replace(/\s*UTC\s*$/i, '')}Z`,
        ).toISOString();

  const buyInSource =
    /buyIn:\s*([^\n]+)/i.exec(content)?.[1] ??
    field(content, 'Buy-In');

  const moneyParts = [
    ...(buyInSource ?? '').matchAll(
      /(\d+(?:[,.]\d+)?)\s*(?:€|EUR)/gi,
    ),
  ].map((match) => cents(match[1]));

  const prize =
    /(?:You won|Prize won|Player prize)\s*:?[ \t]*([^\n]+)/i
      .exec(content)?.[1];

  const duration =
    /(\d+)\s*min(?:ute)?s?\s*(\d+)?\s*s?/i.exec(
      field(content, 'You played') ?? '',
    );

  const position =
    /(\d+)(?:st|nd|rd|th|e)?/i.exec(
      field(content, 'You finished') ?? '',
    )?.[1];

  const players =
    /(\d+)/.exec(
      field(content, 'Registered players') ?? '',
    )?.[1];

  const buyInCents =
    moneyParts[0] ?? cents(buyInSource);

  const feeCents =
    moneyParts[1] ?? 0;

  const prizeCents =
    cents(prize);

  return {
    tournamentId,
    tournamentName: title,
    playerName: player,
    startedAt,
    durationSeconds:
      duration === null
        ? undefined
        : Number(duration[1]) * 60 +
          Number(duration[2] ?? 0),
    buyInCents,
    feeCents,
    prizeCents,
    netResultCents:
      prizeCents - buyInCents - feeCents,
    finishingPosition:
      position === undefined
        ? undefined
        : Number(position),
    registeredPlayers:
      players === undefined
        ? undefined
        : Number(players),
    gameMode: field(content, 'Mode'),
    gameType: field(content, 'Type'),
    speed: field(content, 'Speed'),
    handCount: headers.length,
    handIds: headers.map((header) => header[2]),
    sourceFiles: [sourceFile],
  };
};

export const mergeWinamaxTournaments = (
  items: ParsedWinamaxTournament[],
): ParsedWinamaxTournament[] =>
  [
    ...items.reduce(
      (result, item) => {
        const key =
          `${item.tournamentId}|${item.playerName}`;

        const previous = result.get(key);

        if (previous === undefined) {
          result.set(key, item);
          return result;
        }

        const previousIsSummary =
          previous.sourceFiles.some((name) =>
            /_summary\.txt$/i.test(name),
          );

        const itemIsSummary =
          item.sourceFiles.some((name) =>
            /_summary\.txt$/i.test(name),
          );

        const summary = itemIsSummary
          ? item
          : previousIsSummary
            ? previous
            : undefined;

        const buyInCents =
          summary?.buyInCents ??
          (item.buyInCents || previous.buyInCents);

        const feeCents =
          summary?.feeCents ??
          (item.feeCents || previous.feeCents);

        const prizeCents =
          summary?.prizeCents ??
          Math.max(
            previous.prizeCents,
            item.prizeCents,
          );

        const handIds = [
          ...new Set([
            ...previous.handIds,
            ...item.handIds,
          ]),
        ];

        result.set(key, {
          ...previous,
          ...item,
          tournamentName:
            previous.tournamentName ||
            item.tournamentName,
          startedAt:
            previous.startedAt ||
            item.startedAt,
          durationSeconds:
            summary?.durationSeconds ??
            previous.durationSeconds ??
            item.durationSeconds,
          buyInCents,
          feeCents,
          prizeCents,
          netResultCents:
            prizeCents -
            buyInCents -
            feeCents,
          finishingPosition:
            summary?.finishingPosition ??
            previous.finishingPosition ??
            item.finishingPosition,
          registeredPlayers:
            summary?.registeredPlayers ??
            previous.registeredPlayers ??
            item.registeredPlayers,
          handIds,
          handCount: handIds.length,
          sourceFiles: [
            ...new Set([
              ...previous.sourceFiles,
              ...item.sourceFiles,
            ]),
          ],
        });

        return result;
      },
      new Map<
        string,
        ParsedWinamaxTournament
      >(),
    ).values(),
  ];