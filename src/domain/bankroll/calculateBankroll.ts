import type { FinancialOperation, BankrollSettings, BankrollSnapshot, StoredHand } from './types';
import { calendarDateFor, toCalendarDate } from './calendarDate';
import { isWinamaxImportedOperation } from './winamaxOperation';

const sameDay = (value: string, reference: Date): boolean => toCalendarDate(value) === calendarDateFor(reference);
const sameMonth = (value: string, reference: Date): boolean => toCalendarDate(value).slice(0, 7) === calendarDateFor(reference).slice(0, 7);

export const calculateBankroll = (settings: BankrollSettings, hands: StoredHand[], operations: FinancialOperation[], reference = new Date()): BankrollSnapshot => {
  const winamaxResults = operations.filter((item) => item.type === 'adjustment' && isWinamaxImportedOperation(item));
  const pokerTotalCents = hands.reduce((sum, hand) => sum + hand.netResultCents, 0) + winamaxResults.reduce((sum, item) => sum + item.amountCents, 0);
  const pokerTodayCents = hands.filter((hand) => sameDay(hand.playedAt, reference)).reduce((sum, hand) => sum + hand.netResultCents, 0) + winamaxResults.filter((item) => sameDay(item.date, reference)).reduce((sum, item) => sum + item.amountCents, 0);
  const pokerMonthCents = hands.filter((hand) => sameMonth(hand.playedAt, reference)).reduce((sum, hand) => sum + hand.netResultCents, 0) + winamaxResults.filter((item) => sameMonth(item.date, reference)).reduce((sum, item) => sum + item.amountCents, 0);
  const monthly = (type: FinancialOperation['type']): number => operations.filter((item) => item.type === type && sameMonth(item.date, reference)).reduce((sum, item) => sum + item.amountCents, 0);
  const deposits = operations.filter((item) => item.type === 'deposit').reduce((sum, item) => sum + item.amountCents, 0);
  const withdrawals = operations.filter((item) => item.type === 'withdrawal').reduce((sum, item) => sum + item.amountCents, 0);
  const expenses = operations.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0);
  const manualAdjustments = operations.filter((item) => item.type === 'adjustment' && !isWinamaxImportedOperation(item)).reduce((sum, item) => sum + item.amountCents, 0);
  return { currentCents: settings.initialBankrollCents + pokerTotalCents + deposits - withdrawals - expenses + manualAdjustments, pokerTodayCents, pokerMonthCents, depositMonthCents: monthly('deposit'), withdrawalMonthCents: monthly('withdrawal'), pokerTotalCents };
};
