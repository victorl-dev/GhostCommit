import * as vscode from 'vscode';
import * as path from 'path';
import { SessionCache, SessionEntry } from './SessionCache';
import { AISummarizer } from './AISummarizer';
import { ShadowRepo } from '../github/ShadowRepo';
import { ProfileUpdater } from '../github/ProfileUpdater';
import { StatusBarManager } from '../status/StatusBar';

const OBFUSCATED_NAME = '[private]';

export class FileMonitor {
  private disposable: vscode.Disposable | undefined;
  private running = false;
  private lastActivityTime = Date.now();
  private saveCount = 0;
  private flushTimer: NodeJS.Timeout | undefined;

  constructor(
    private cache: SessionCache,
    private ai: AISummarizer,
    private shadowRepo: ShadowRepo,
    private profileUpdater: ProfileUpdater,
    private statusBar: StatusBarManager
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.cache.startNewSession();
    this.disposable = vscode.workspace.onDidSaveTextDocument(doc => this.onSave(doc));
    this.startFlushTimer();
    this.statusBar.setTracking(true);
  }

  stop() {
    this.running = false;
    this.disposable?.dispose();
    this.disposable = undefined;
    this.clearFlushTimer();
    this.statusBar.setTracking(false);
  }

  isRunning(): boolean {
    return this.running;
  }

  private isBlacklisted(docUri: vscode.Uri): { hidden: boolean; matchedPath?: string } {
    const config = vscode.workspace.getConfiguration('vibetracker');
    const blacklist = config.get<string[]>('projectBlacklist', []);
    const filePath = docUri.fsPath.toLowerCase();
    for (const bp of blacklist) {
      const normalized = bp.replace(/\\/g, '/').toLowerCase();
      if (filePath.includes(normalized)) {
        return { hidden: true, matchedPath: bp };
      }
    }
    return { hidden: false };
  }

  private onSave(doc: vscode.TextDocument) {
    if (!this.running) return;
    if (doc.uri.scheme !== 'file') return;

    this.lastActivityTime = Date.now();
    this.saveCount++;

    const stats = this.getLineStats(doc);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    const projectName = workspaceFolder ? path.basename(workspaceFolder.uri.fsPath) : 'unknown';
    const { hidden: isHidden } = this.isBlacklisted(doc.uri);

    const entry: SessionEntry = {
      timestamp: new Date().toISOString(),
      fileExt: path.extname(doc.fileName),
      linesAdded: stats.added,
      linesRemoved: stats.removed,
      projectName: isHidden ? OBFUSCATED_NAME : projectName,
      fileName: isHidden ? '[hidden]' : path.basename(doc.fileName),
      hidden: isHidden
    };

    this.cache.addEntry(entry);
    this.statusBar.updateText(`${this.saveCount} saves${isHidden ? ' 🔒' : ''}`);
    this.checkFlushConditions();
  }

  private getLineStats(doc: vscode.TextDocument): { added: number; removed: number } {
    const lineCount = doc.lineCount;
    return { added: lineCount > 0 ? Math.floor(Math.random() * 10) + 1 : 0, removed: 0 };
  }

  private checkFlushConditions() {
    const config = vscode.workspace.getConfiguration('vibetracker');
    const threshold = config.get<number>('savesThreshold', 50);
    const idleMinutes = config.get<number>('flushInterval', 30);

    if (this.saveCount >= threshold) {
      this.flush();
      return;
    }

    const elapsed = (Date.now() - this.lastActivityTime) / 1000 / 60;
    if (elapsed >= idleMinutes && this.saveCount > 0) {
      this.flush();
    }
  }

  private async flush() {
    const session = this.cache.getCurrentSession();
    if (!session || session.entries.length === 0) return;

    this.clearFlushTimer();
    this.saveCount = 0;

    try {
      const summary = await this.ai.generateSummary(session.entries);
      this.cache.commitSession(summary);

      try {
        await this.shadowRepo.commitActivity(summary, session.entries.length);
      } catch (err: any) {
        console.error('VibeTracker: Shadow commit failed', err?.message);
      }

      try {
        await this.profileUpdater.update();
      } catch (err: any) {
        const msg = `VibeTracker: Profile update failed - ${err?.message || err}`;
        console.error(msg);
      }

      this.cache.startNewSession();
    } catch (err) {
      console.error('VibeTracker: Flush failed', err);
    }

    this.startFlushTimer();
  }

  private startFlushTimer() {
    const config = vscode.workspace.getConfiguration('vibetracker');
    const intervalMs = (config.get<number>('flushInterval', 30) + 1) * 60 * 1000;
    this.flushTimer = setInterval(() => this.checkFlushConditions(), intervalMs);
  }

  private clearFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}
