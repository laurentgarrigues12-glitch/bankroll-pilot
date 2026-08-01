import { type ReactElement, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CreditCard,
  FileUp,
  LayoutDashboard,
  LoaderCircle,
  Settings,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react';
import { bankrollService } from '../application/bankroll/bankrollService';
import { BankrollChart } from './components/BankrollChart';
import './dashboard.css';
import { useBankrollData } from './hooks/useBankrollData';
import { SettingsPage as SettingsPageView } from './pages/SettingsPage';
import { OperationsPage } from './pages/OperationsPage';
import { WinamaxImportPage } from './pages/WinamaxImportPage';
import { useAccessStatus } from './hooks/useAccessStatus';
import { useWinamaxAutoImport } from './hooks/useWinamaxAutoImport';
import type { AccessState } from '../domain/access/types';
import type { WinamaxImportDiagnostic } from './winamaxImportDiagnostic';
import bankrollPilotLogo from './assets/bankroll-pilot-a1.svg';

type Page = 'Dashboard' | 'Opérations' | 'Import Winamax' | 'Paramètres';
type Period = '7' | '30' | 'all';
const navigation: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Opérations', icon: CreditCard },
  { label: 'Import Winamax', icon: FileUp },
  { label: 'Paramètres', icon: Settings },
];
const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const localDate = new Intl.DateTimeFormat('fr-FR');

export function App(): ReactElement {
  const [page, setPage] = useState<Page>('Dashboard');
  const [winamaxDiagnostic, setWinamaxDiagnostic] = useState<WinamaxImportDiagnostic | null>(null);
  const bankroll = useBankrollData();
  const accessStatus = useAccessStatus();
  useWinamaxAutoImport(
    accessStatus.access?.canImport === true && bankroll.data?.settings !== undefined,
    bankroll.refresh,
  );
  if (accessStatus.loading || accessStatus.access === null)
    return (
      <div className="app-shell">
        <main className="content">
          <section className="empty-state" aria-label="Vérification de l’accès">
            <span className="empty-state-icon">
              <LoaderCircle className="spin" size={24} />
            </span>
            <div>
              <h2>Préparation de votre espace</h2>
              <p>Vérification de l’accès et chargement des données locales…</p>
            </div>
          </section>
        </main>
      </div>
    );
  if (accessStatus.access.status === 'not_started')
    return <Welcome onStart={() => void accessStatus.startTrial()} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <WalletCards size={19} />
          </span>
          <span>
            Bankroll <strong>Pilot</strong>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={page === label ? 'nav-item active' : 'nav-item'}
              onClick={() => setPage(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Version navigateur</span>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-inner">
            <div>
              <p className="eyebrow">VUE D’ENSEMBLE</p>
              <h1>{page}</h1>
            </div>
            <img
              className="topbar-logo"
              src={bankrollPilotLogo}
              alt="Bankroll Pilot"
            />
          </div>
        </header>
        <main className="content">
          <AccessBanner access={accessStatus.access} />
          {page === 'Dashboard' && <Dashboard {...bankroll} />}
          {page === 'Opérations' && (
            <OperationsPage
              operations={bankroll.data?.operations ?? []}
              onSaved={bankroll.refresh}
              readOnly={!accessStatus.access.canWrite}
            />
          )}
          {page === 'Import Winamax' && (
            <WinamaxImportPage
              onImported={bankroll.refresh}
              readOnly={!accessStatus.access.canImport}
              onDiagnostic={setWinamaxDiagnostic}
            />
          )}
          {page === 'Paramètres' && (
            <SettingsPageView
              settings={bankroll.data?.settings}
              onSaved={bankroll.refresh}
              access={accessStatus.access}
              onSimulateAccess={accessStatus.simulate}
              winamaxDiagnostic={winamaxDiagnostic}
              onInspectWinamax={() => bankrollService.inspectWinamaxOperations()}
              onRepairWinamax={async () => {
                const result = await bankrollService.repairLegacyWinamaxOperations();
                await bankroll.refresh();
                return result;
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }): ReactElement {
  // The three-place limit is editorial for now; a remote provider will enforce it later.
  return (
    <main className="welcome-page">
      <section className="welcome-card">
        <p className="section-kicker">BÊTA PRIVÉE</p>
        <h1>Testez Bankroll Pilot gratuitement</h1>
        <p>
          Je recherche 3 joueurs maximum pour tester la version bêta de Bankroll Pilot pendant 3
          jours.
        </p>
        <p className="welcome-detail">
          Cette première phase permettra de vérifier l’interface, l’import Winamax et le bon
          fonctionnement de l’application avec de vraies utilisations.
        </p>
        <span className="beta-capacity">3 places maximum</span>
        <ul className="welcome-features">
          <li>Suivi de votre bankroll</li>
          <li>Gestion des dépôts et retraits</li>
          <li>Import de fichiers Winamax</li>
          <li>Graphique d’évolution</li>
          <li>Sauvegarde et restauration de vos données</li>
        </ul>
        <div className="welcome-notes">
          <span>Bêta gratuite pendant 3 jours</span>
          <span>Aucune carte bancaire demandée</span>
          <span>Données enregistrées localement dans le navigateur</span>
          <span>Export des données disponible à tout moment</span>
        </div>
        <button className="secondary-button" onClick={onStart}>
          Commencer la bêta gratuite
        </button>
        <p className="welcome-consent">
          En commençant la bêta, vous acceptez de tester une version encore en cours de finalisation
          et de signaler les éventuels problèmes rencontrés.
        </p>
      </section>
    </main>
  );
}
function AccessBanner({ access }: { access: AccessState }): ReactElement {
  if (access.status === 'active') return <></>;
  if (access.status === 'trial')
    return (
      <section className="access-banner" role="status">
        <strong>Essai gratuit en cours</strong>
        <span>Expire le {new Date(access.trialExpiresAt ?? '').toLocaleString('fr-FR')}.</span>
      </section>
    );
  if (access.status === 'expired')
    return (
      <section className="access-banner expired" role="status">
        <strong>Votre période d’essai est terminée</strong>
        <span>
          Vos données sont conservées. L’application est en lecture seule et l’export reste
          disponible.
        </span>
      </section>
    );
  return (
    <section className="access-banner expired" role="alert">
      <strong>Service d’accès indisponible</strong>
      <span>Vos données restent consultables. Les modifications sont désactivées.</span>
    </section>
  );
}

function Dashboard({
  data,
  loading,
  error,
  refresh,
}: ReturnType<typeof useBankrollData>): ReactElement {
  const [period, setPeriod] = useState<Period>('30');
  if (loading)
    return (
      <section className="empty-state">
        <p>Chargement des données locales…</p>
      </section>
    );
  if (error !== null)
    return (
      <section className="empty-state error-empty-state" role="alert">
        <span className="empty-state-icon">
          <AlertCircle size={24} />
        </span>
        <div>
          <h2>Données indisponibles</h2>
          <p>{error}</p>
        </div>
        <button onClick={() => void refresh()}>Réessayer</button>
      </section>
    );
  if (data?.settings === undefined || data.snapshot === undefined)
    return (
      <section className="empty-state">
        <span className="empty-state-icon">
          <SlidersHorizontal size={24} />
        </span>
        <div>
          <span className="state-badge">Première étape</span>
          <h2>Configurez votre bankroll initiale</h2>
          <p>Définissez votre montant de départ dans Paramètres pour activer le tableau de bord.</p>
        </div>
      </section>
    );
  const series = bankrollService.createChartSeries(data.settings, data.hands, data.operations);
  const displayed =
    period === '7' ? series.slice(-7) : period === '30' ? series.slice(-30) : series;
  const snapshot = data.snapshot;
  const summaryRows = [
    { label: 'Date', value: localDate.format(new Date()) },
    { label: 'Dépôt du mois', value: currency.format(snapshot.depositMonthCents / 100) },
    { label: 'Retraits du mois', value: currency.format(snapshot.withdrawalMonthCents / 100) },
    {
      label: 'Résultat du mois',
      value: signed(snapshot.pokerMonthCents),
      result: snapshot.pokerMonthCents,
    },
    {
      label: 'Résultat du jour',
      value: signed(snapshot.pokerTodayCents),
      result: snapshot.pokerTodayCents,
    },
    { label: 'Bankroll actuelle', value: currency.format(snapshot.currentCents / 100) },
  ];
  return (
    <>
      <section className="hero">
        <div>
          <p className="section-kicker">SUIVI DE BANKROLL</p>
          <h2>Votre performance, en un regard.</h2>
          <p>Visualisez l’évolution de vos résultats réels.</p>
        </div>
        <div className="hero-icon">
          <BarChart3 size={30} />
        </div>
      </section>
      <section className="bankroll-summary" aria-labelledby="bankroll-summary-title">
        <div className="summary-heading">
          <div>
            <p className="section-kicker">SYNTHÈSE</p>
            <h2 id="bankroll-summary-title">Récapitulatif</h2>
          </div>
          <span>Données réelles</span>
        </div>
        <div className="summary-table-wrapper">
          <table className="summary-table summary-table-horizontal">
            <thead>
              <tr>
                {summaryRows.map(({ label }) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {summaryRows.map(({ label, value, result }) => (
                  <td
                    key={label}
                    data-label={label}
                    className={
                      result === undefined || result === 0
                        ? ''
                        : result > 0
                          ? 'positive'
                          : 'negative'
                    }
                  >
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="chart-card">
        <div className="dashboard-heading">
          <div>
            <p className="section-kicker">ÉVOLUTION</p>
            <h2>Bankroll</h2>
          </div>
          <div className="period-filters">
            {(['7', '30', 'all'] as Period[]).map((value) => (
              <button
                key={value}
                className={period === value ? 'period-button active' : 'period-button'}
                onClick={() => setPeriod(value)}
              >
                {value === 'all' ? 'Tout' : `${value} jours`}
              </button>
            ))}
          </div>
        </div>
        <BankrollChart data={displayed} state={displayed.length === 0 ? 'empty' : 'ready'} />
      </section>
    </>
  );
}
function signed(cents: number): string {
  if (cents === 0) return currency.format(0);
  return `${cents > 0 ? '+' : ''}${currency.format(cents / 100)}`;
}
