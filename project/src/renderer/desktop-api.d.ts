interface DesktopWinamaxFile {
  relativeName: string;
  name: string;
  size: number;
  lastModified: number;
  content: string;
}
interface DesktopTrialState {
  status: 'not_started' | 'trial' | 'expired';
  startedAt: string | null;
  expiresAt: string | null;
  remainingMilliseconds: number;
}
interface BankrollDesktopApi {
  isDesktop: true;
  selectWinamaxFolder(): Promise<{ directoryPath: string; directoryName: string } | null>;
  readWinamaxFolder(directoryPath: string): Promise<DesktopWinamaxFile[]>;
  findWinamaxFolder(): Promise<{ directoryPath: string; directoryName: string } | null>;
  getTrialState(): Promise<DesktopTrialState>;
  startTrial(): Promise<DesktopTrialState>;
}
interface Window { bankrollDesktop?: BankrollDesktopApi; }
