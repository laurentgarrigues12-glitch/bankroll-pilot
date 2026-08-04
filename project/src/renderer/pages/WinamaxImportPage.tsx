import type { ReactElement } from 'react';
import type { WinamaxImportDiagnostic } from '../winamaxImportDiagnostic';
import { WinamaxFolderSettings } from './WinamaxFolderSettings';
import './WinamaxImportPage.css';

interface WinamaxImportPageProps {
  onImported: () => Promise<void>;
  readOnly?: boolean;
  onDiagnostic?: (diagnostic: WinamaxImportDiagnostic) => void;
}

export function WinamaxImportPage({
  onImported,
  readOnly = false,
}: WinamaxImportPageProps): ReactElement {
  return (
    <section className="winamax-import-page">
      <WinamaxFolderSettings readOnly={readOnly} onImported={onImported} />
    </section>
  );
}
