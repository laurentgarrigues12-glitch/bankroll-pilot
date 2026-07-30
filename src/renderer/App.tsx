import { type ReactElement, useState } from 'react';
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

type Page = 'Dashboard' | 'Opérations' | 'Paramètres';

const navigation: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Opérations', icon: CreditCard },
  { label: 'Paramètres', icon: Settings },
];

export function App(): ReactElement {
  const [page, setPage] = useState<Page>('Dashboard');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><WalletCards size={19} /></span><span>Bankroll <strong>Pilot</strong></span></div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => setPage(label)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Version navigateur</div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">VUE D’ENSEMBLE</p><h1>{page}</h1></div>
          <div className="topbar-actions"><span className="preview-badge">Google Chrome</span><button className="profile-button" aria-label="Profil utilisateur">LP</button></div>
        </header>

        <main className="content">
          {page === 'Dashboard' && <Dashboard />}
          {page === 'Opérations' && <Operations />}
          {page === 'Paramètres' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

function Dashboard(): ReactElement {
  return <>
    <section className="hero"><div><p className="section-kicker">SUIVI DE BANKROLL</p><h2>Votre performance, en un regard.</h2><p>Importez vos historiques Winamax pour commencer à suivre vos résultats.</p></div><div className="hero-icon"><BarChart3 size={30} /></div></section>
    <section className="metrics-grid" aria-label="Indicateurs de bankroll">
      <MetricCard label="Bankroll actuelle" value="—" icon={WalletCards} accent="green" />
      <MetricCard label="Résultat du jour" value="—" icon={ArrowUpRight} accent="neutral" />
      <MetricCard label="Dépôts" value="—" icon={ArrowDownLeft} accent="neutral" />
    </section>
    <section className="empty-chart"><div className="chart-placeholder"><BarChart3 size={28} /><p>L’évolution de votre bankroll apparaîtra ici.</p></div></section>
  </>;
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof WalletCards; accent: 'green' | 'neutral' }): ReactElement {
  return <article className={`metric-card ${accent}`}><div className="metric-icon"><Icon size={19} /></div><p>{label}</p><strong>{value}</strong><span className="metric-detail">En attente de données</span></article>;
}

function Operations(): ReactElement {
  return <section className="empty-state"><div className="empty-state-icon"><CreditCard size={25} /></div><h2>Vos opérations</h2><p>Les dépôts, retraits et dépenses seront disponibles dans le prochain lot.</p></section>;
}

function SettingsPage(): ReactElement {
  return <section className="settings-card"><div className="settings-heading"><div className="settings-icon"><FolderOpen size={22} /></div><div><p className="section-kicker">SOURCE DE DONNÉES</p><h2>Historique Winamax</h2></div></div><div className="directory-row"><div><span className="field-label">Import navigateur</span><strong>Import des historiques Winamax (version navigateur) — fonctionnalité en cours de développement.</strong></div></div></section>;
}
