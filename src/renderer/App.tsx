import { type ReactElement, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  Settings,
  WalletCards,
} from 'lucide-react';
import { BankrollChart } from './components/BankrollChart';
import { demoBankroll, demoMonthlyWithdrawalsTotal, demoWithdrawalsTotal } from './data/demoBankroll';
import { WinamaxImportPanel } from '../features/winamax/WinamaxImportPanel';
import './dashboard.css';

type Page = 'Dashboard' | 'Opérations' | 'Paramètres';
type Period = '7' | '30' | 'all';

const navigation: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Opérations', icon: CreditCard },
  { label: 'Paramètres', icon: Settings },
];

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function App(): ReactElement {
  const [page, setPage] = useState<Page>('Dashboard');
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><WalletCards size={19} /></span><span>Bankroll <strong>Pilot</strong></span></div>
      <nav className="sidebar-nav" aria-label="Navigation principale">{navigation.map(({ label, icon: Icon }) => <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => setPage(label)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><span className="status-dot" /> Version navigateur</div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div><p className="eyebrow">VUE D’ENSEMBLE</p><h1>{page}</h1></div><div className="topbar-actions"><span className="preview-badge">Google Chrome</span><button className="profile-button" aria-label="Profil utilisateur">LP</button></div></header>
      <main className="content">{page === 'Dashboard' && <Dashboard />}{page === 'Opérations' && <Operations />}{page === 'Paramètres' && <SettingsPage />}</main>
    </div>
  </div>;
}

function Dashboard(): ReactElement {
  const [period, setPeriod] = useState<Period>('30');
  const displayedData = useMemo(() => period === '7' ? demoBankroll.slice(-7) : demoBankroll, [period]);
  const currentBankroll = demoBankroll.at(-1)?.bankroll ?? 0;
  const dailyResult = demoBankroll.at(-1)?.dailyResult ?? 0;
  const monthlyResult = demoBankroll.reduce((total, day) => total + day.dailyResult, 0);
  const periodLabel = period === 'all' ? 'Tout' : `${period} jours`;

  return <>
    <section className="hero"><div><p className="section-kicker">SUIVI DE BANKROLL</p><h2>Votre performance, en un regard.</h2><p>Visualisez l’évolution de vos résultats grâce aux données de démonstration.</p></div><div className="hero-icon"><BarChart3 size={30} /></div></section>
    <section className="metrics-grid five-metrics" aria-label="Indicateurs de bankroll">
      <MetricCard label="Bankroll actuelle" value={currency.format(currentBankroll)} icon={WalletCards} />
      <MetricCard label="Résultat du jour" value={signedCurrency(dailyResult)} icon={ArrowUpRight} result={dailyResult} />
      <MetricCard label="Résultat du mois" value={signedCurrency(monthlyResult)} icon={BarChart3} result={monthlyResult} />
      <MetricCard label="Retraits totaux" value={currency.format(demoWithdrawalsTotal)} icon={ArrowDownLeft} />
      <MetricCard label="Retraits du mois" value={currency.format(demoMonthlyWithdrawalsTotal)} icon={CreditCard} />
    </section>
    <section className="chart-card"><div className="dashboard-heading"><div><p className="section-kicker">ÉVOLUTION</p><h2>Bankroll</h2></div><div className="period-filters" aria-label="Période du graphique">{(['7', '30', 'all'] as Period[]).map((value) => <button key={value} className={period === value ? 'period-button active' : 'period-button'} onClick={() => setPeriod(value)}>{value === 'all' ? 'Tout' : `${value} jours`}</button>)}</div></div><span className="sr-only" aria-live="polite">Période affichée : {periodLabel}</span><BankrollChart data={displayedData} /></section>
  </>;
}

function signedCurrency(value: number): string { return `${value >= 0 ? '+' : ''}${currency.format(value)}`; }

function MetricCard({ label, value, icon: Icon, result }: { label: string; value: string; icon: typeof WalletCards; result?: number }): ReactElement {
  const resultClass = result === undefined ? '' : result >= 0 ? 'positive' : 'negative';
  return <article className="metric-card compact"><div className="metric-icon"><Icon size={19} /></div><p>{label}</p><strong className={resultClass}>{value}</strong><span className="metric-detail">Données de démonstration</span></article>;
}

function Operations(): ReactElement { return <section className="empty-state"><div className="empty-state-icon"><CreditCard size={25} /></div><h2>Vos opérations</h2><p>Les dépôts, retraits et dépenses seront disponibles dans le prochain lot.</p></section>; }

function SettingsPage(): ReactElement { return <section className="settings-card"><div className="settings-heading"><div className="settings-icon"><FolderOpen size={22} /></div><div><p className="section-kicker">SOURCE DE DONNÉES</p><h2>Historique Winamax</h2></div></div><div className="directory-row"><div><span className="field-label">Import navigateur</span><strong>Prévisualisez des historiques sélectionnés localement dans Google Chrome.</strong></div></div><WinamaxImportPanel /></section>; }
