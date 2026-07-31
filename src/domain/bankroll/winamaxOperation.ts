import type { FinancialOperation } from './types';

const tournamentIdentity = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLocaleLowerCase().replace(/^winamax:/, '');
  return /^tournament:\d+:[^\s:]+$/.test(normalized) ? normalized : undefined;
};

export const winamaxSourceIdFor = (operation: FinancialOperation): string | undefined =>
  tournamentIdentity(operation.sourceId) ?? tournamentIdentity(operation.metadata?.sourceId) ?? tournamentIdentity(operation.id);

export const isWinamaxImportedOperation = (operation: FinancialOperation): boolean =>
  operation.source === 'winamax' || operation.metadata?.source === 'winamax' || winamaxSourceIdFor(operation) !== undefined || operation.id.startsWith('winamax:');

export const normalizeWinamaxOperation = (operation: FinancialOperation): FinancialOperation => {
  if (!isWinamaxImportedOperation(operation)) return operation;
  const sourceId = winamaxSourceIdFor(operation);
  return { ...operation, source: 'winamax', ...(sourceId === undefined ? {} : { sourceId }) };
};
