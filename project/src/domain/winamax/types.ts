export type WinamaxGameType = 'HOLDEM_NO_LIMIT';
export type WinamaxCurrency = 'EUR' | 'USD';

export interface WinamaxPlayerResult {
  playerName: string;
  investedAmount: number;
  recoveredAmount: number;
  netResult: number;
}

export interface ParsedWinamaxHand {
  handId: string;
  playedAt: string;
  tableName: string;
  gameType: WinamaxGameType;
  currency: WinamaxCurrency;
  smallBlind: number;
  bigBlind: number;
  mainPlayer?: string;
  playerResult?: WinamaxPlayerResult;
  fingerprint: string;
}

export type WinamaxParseErrorCode = 'INCOMPLETE_HAND' | 'UNSUPPORTED_FORMAT' | 'UNSUPPORTED_GAME' | 'INVALID_AMOUNT' | 'PLAYER_NOT_DETECTED';

export interface WinamaxParseError {
  code: WinamaxParseErrorCode;
  message: string;
  blockIndex: number;
  handId?: string;
  fileName?: string;
}

export interface WinamaxParseResult {
  hands: ParsedWinamaxHand[];
  errors: WinamaxParseError[];
  detectedBlockCount: number;
}

export interface WinamaxImportSummary {
  fileCount: number;
  detectedBlockCount: number;
  validHandCount: number;
  duplicateCount: number;
  errorCount: number;
  netResultTotal: number;
  errors: WinamaxParseError[];
}
