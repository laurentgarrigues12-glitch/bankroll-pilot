export interface DemoBankrollPoint {
  date: string;
  bankroll: number;
  dailyResult: number;
}

export const demoBankroll: DemoBankrollPoint[] = [
  ['01 juil.', 1020, 20], ['02 juil.', 1005, -15], ['03 juil.', 1038, 33], ['04 juil.', 1026, -12], ['05 juil.', 1066, 40], ['06 juil.', 1058, -8], ['07 juil.', 1090, 32], ['08 juil.', 1114, 24], ['09 juil.', 1100, -14], ['10 juil.', 1127, 27],
  ['11 juil.', 1116, -11], ['12 juil.', 1151, 35], ['13 juil.', 1170, 19], ['14 juil.', 1150, -20], ['15 juil.', 1184, 34], ['16 juil.', 1177, -7], ['17 juil.', 1218, 41], ['18 juil.', 1200, -18], ['19 juil.', 1226, 26], ['20 juil.', 1243, 17],
  ['21 juil.', 1234, -9], ['22 juil.', 1264, 30], ['23 juil.', 1251, -13], ['24 juil.', 1289, 38], ['25 juil.', 1275, -14], ['26 juil.', 1300, 25], ['27 juil.', 1316, 16], ['28 juil.', 1295, -21], ['29 juil.', 1322, 27], ['30 juil.', 1359, 37],
].map(([date, bankroll, dailyResult]) => ({ date: String(date), bankroll: Number(bankroll), dailyResult: Number(dailyResult) }));

export const demoWithdrawalsTotal = 180;
export const demoMonthlyWithdrawalsTotal = 45;
