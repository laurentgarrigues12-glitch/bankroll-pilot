import { useCallback, useEffect, useState } from 'react';
import { bankrollService, type DashboardModel } from '../../application/bankroll/bankrollService';

export const useBankrollData = (): { data: DashboardModel | null; loading: boolean; error: string | null; refresh: () => Promise<void> } => {
  const [data, setData] = useState<DashboardModel | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (): Promise<void> => { setLoading(true); try { setData(await bankrollService.load()); setError(null); } catch { setError('Les données locales sont indisponibles.'); } finally { setLoading(false); } }, []);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleMidnightRefresh = (): void => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      timeout = setTimeout(() => {
        void refresh();
        scheduleMidnightRefresh();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleMidnightRefresh();
    return () => clearTimeout(timeout);
  }, [refresh]);
  return { data, loading, error, refresh };
};
