import { type ReactElement } from 'react';
import { AlertCircle, BarChart3, LoaderCircle } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DemoBankrollPoint } from '../data/demoBankroll';
import './BankrollChart.css';

export type ChartState = 'loading' | 'ready' | 'empty' | 'error';

interface BankrollChartProps {
  data: DemoBankrollPoint[];
  state?: ChartState;
}

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DemoBankrollPoint }> }): ReactElement | null {
  if (!active || payload === undefined || payload.length === 0) return null;
  const point = payload[0].payload;
  const resultClass = point.dailyResult >= 0 ? 'positive' : 'negative';
  return <div className="chart-tooltip"><span>{point.date}</span><strong>{currency.format(point.bankroll)}</strong><small className={resultClass}>Résultat : {point.dailyResult >= 0 ? '+' : ''}{currency.format(point.dailyResult)}</small></div>;
}

export function BankrollChart({ data, state = 'ready' }: BankrollChartProps): ReactElement {
  if (state === 'loading') return <section className="chart-state" aria-label="Chargement du graphique"><LoaderCircle className="spin" size={24} /><p>Chargement des données…</p></section>;
  if (state === 'error') return <section className="chart-state error-state" role="alert"><AlertCircle size={24} /><p>Le graphique est indisponible pour le moment.</p></section>;
  if (state === 'empty' || data.length === 0) return <section className="chart-state" aria-label="Aucune donnée"><BarChart3 size={24} /><p>Aucune donnée de bankroll à afficher.</p></section>;

  return <section className="bankroll-chart" aria-label="Évolution de la bankroll">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value} €`} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent-secondary)', strokeDasharray: '3 4' }} />
        <Line type="monotone" dataKey="bankroll" stroke="var(--accent-secondary)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: 'var(--accent-secondary)', stroke: 'var(--bg-main)', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  </section>;
}
