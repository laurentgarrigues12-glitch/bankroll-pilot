import type { ReactElement } from 'react';
import type { WinamaxImportDiagnostic } from '../winamaxImportDiagnostic';
import type { WinamaxAutoImportStatus } from '../hooks/useWinamaxAutoImport';
import { WinamaxFolderSettings } from './WinamaxFolderSettings';
import './WinamaxImportPage.css';

interface WinamaxImportPageProps {
  onImported: () => Promise<void>;
  readOnly?: boolean;
  onDiagnostic?: (diagnostic: WinamaxImportDiagnostic) => void;
  autoImportStatus?: WinamaxAutoImportStatus;
}

export function WinamaxImportPage({
  onImported,
  readOnly = false,
  autoImportStatus,
}: WinamaxImportPageProps): ReactElement {
  return (
    <section className="winamax-import-page">
      <WinamaxFolderSettings readOnly={readOnly} onImported={onImported} autoImportStatus={autoImportStatus} />
    </section>
  );
}
