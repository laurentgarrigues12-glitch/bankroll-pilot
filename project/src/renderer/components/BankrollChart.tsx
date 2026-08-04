import { type ReactElement } from 'react';
import {
  AlertCircle,
  BarChart3,
  LoaderCircle,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BankrollChartPoint } from '../../application/bankroll/bankrollService';
import './BankrollChart.css';

export type ChartState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

interface BankrollChartProps {
  data: BankrollChartPoint[];
  state?: ChartState;
}

interface LastPointLabelProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: BankrollChartPoint;
  lastIndex: number;
}

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: BankrollChartPoint;
  }>;
}): ReactElement | null {
  if (
    !active ||
    payload === undefined ||
    payload.length === 0
  ) {
    return null;
  }

  const point = payload[0].payload;
  const resultClass =
    point.dailyResult >= 0 ? 'positive' : 'negative';

  return (
    <div className="chart-tooltip">
      <span>{point.date}</span>

      <strong>
        {currency.format(point.bankroll)}
      </strong>

      <small className={resultClass}>
        Résultat : {point.dailyResult >= 0 ? '+' : ''}
        {currency.format(point.dailyResult)}
      </small>
    </div>
  );
}

function LastPointLabel({
  cx,
  cy,
  index,
  payload,
  lastIndex,
}: LastPointLabelProps): ReactElement | null {
  if (
    cx === undefined ||
    cy === undefined ||
    index !== lastIndex ||
    payload === undefined
  ) {
    return null;
  }

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--accent-secondary)"
        stroke="var(--bg-main)"
        strokeWidth={2}
      />

      <text
        x={cx + 12}
        y={cy}
        dominantBaseline="middle"
        fill="var(--text-primary)"
        fontSize={13}
        fontWeight={700}
        stroke="var(--bg-main)"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {currency.format(payload.bankroll)}
      </text>
    </g>
  );
}

export function BankrollChart({
  data,
  state = 'ready',
}: BankrollChartProps): ReactElement {
  if (state === 'loading') {
    return (
      <section
        className="chart-state"
        aria-label="Chargement du graphique"
      >
        <LoaderCircle
          className="spin"
          size={24}
        />

        <p>Chargement des données…</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section
        className="chart-state error-state"
        role="alert"
      >
        <AlertCircle size={24} />

        <p>
          Le graphique est indisponible pour le moment.
        </p>
      </section>
    );
  }

  if (state === 'empty' || data.length === 0) {
    return (
      <section
        className="chart-state chart-empty"
        aria-label="Aucune donnée"
      >
        <span className="empty-state-icon">
          <BarChart3 size={22} />
        </span>

        <span className="state-badge">
          En attente de données
        </span>

        <h3>Votre courbe se dessinera ici</h3>

        <p>
          Importez des parties Winamax ou ajoutez une
          opération pour démarrer le suivi.
        </p>
      </section>
    );
  }

  const lastIndex = data.length - 1;

  return (
    <section
      className="bankroll-chart"
      aria-label="Évolution de la bankroll"
    >
      

      <ResponsiveContainer
        width="100%"
        height={300}
      >
        <LineChart
          data={data}
          margin={{
            top: 12,
            right: 88,
            left: -10,
            bottom: 0,
          }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 6"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: 11,
            }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: 11,
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              currency.format(value)
            }
            width={72}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke: 'var(--accent-secondary)',
              strokeDasharray: '3 4',
            }}
          />

          <Line
            type="monotone"
            dataKey="bankroll"
            stroke="var(--accent-secondary)"
            strokeWidth={3}
            dot={(props) => (
              <LastPointLabel
                {...props}
                lastIndex={lastIndex}
              />
            )}
            activeDot={{
              r: 5,
              fill: 'var(--accent-secondary)',
              stroke: 'var(--bg-main)',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}