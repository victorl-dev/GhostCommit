import * as vscode from 'vscode';
import * as path from 'path';
import { SessionCache, SessionEntry } from './SessionCache';
import { AISummarizer } from './AISummarizer';
import { ShadowRepo } from '../github/ShadowRepo';
import { ProfileUpdater } from '../github/ProfileUpdater';
import { StatusBarManager } from '../status/StatusBar';

const OBFUSCATED_NAME = '[private]';
const TRACKED_EXTS = new Set(['.ts','.tsx','.js','.jsx','.py','.rs','.go','.java','.kt','.swift','.dart','.rb','.php','.c','.cpp','.h','.hpp','.cs','.fs','.vue','.svelte','.css','.scss','.less','.html','.json','.yaml','.yml','.toml','.md','.sql','.graphql','.prisma']);

const OUT = vscode.window.createOutputChannel('ghostcommit:tracker');

export class FileMonitor {
  private disposables: vscode.Disposable[] = [];
  private running = false;
  private lastActivityTime = Date.now();
  private uniqueFiles = new Set<string>();
  private totalChanges = 0;
  private flushTimer: NodeJS.Timeout | undefined;
  private lastSeen = new Map<string, number>();

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

    // 1. Manual saves (Ctrl+S)
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => this.onFileChange(doc.uri, 'save'))
    );

    // 2. File system changes from AI agents / external tools
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.disposables.push(watcher);
    this.disposables.push(
      watcher.onDidChange(uri => this.onFileChange(uri, 'fschange')),
      watcher.onDidCreate(uri => this.onFileChange(uri, 'create'))
    );

    // 3. Workspace file creation events
    this.disposables.push(
      vscode.workspace.onDidCreateFiles(event => {
        for (const uri of event.files) {
          this.onFileChange(uri, 'wscreate');
        }
      })
    );

    this.startFlushTimer();
    this.statusBar.setTracking(true);
  }

  stop() {
    this.running = false;
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.clearFlushTimer();
    this.statusBar.setTracking(false);
  }

  isRunning(): boolean {
    return this.running;
  }

  private isBlacklisted(docUri: vscode.Uri): { hidden: boolean; matchedPath?: string } {
    const config = vscode.workspace.getConfiguration('ghostcommit');
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

  private isTrackedExt(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
    return TRACKED_EXTS.has(ext);
  }

  private onFileChange(uri: vscode.Uri, source: string) {
    if (!this.running) return;
    if (uri.scheme !== 'file') return;
    if (!this.isTrackedExt(uri)) return;

    const fileKey = uri.fsPath.toLowerCase();
    const now = Date.now();
    const last = this.lastSeen.get(fileKey) || 0;
    if (now - last < 500) return;
    this.lastSeen.set(fileKey, now);

    this.lastActivityTime = now;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const projectName = workspaceFolder ? path.basename(workspaceFolder.uri.fsPath) : 'unknown';
    const { hidden: isHidden } = this.isBlacklisted(uri);

    this.cache.addEntry({
      timestamp: new Date().toISOString(),
      fileExt: path.extname(uri.fsPath),
      linesAdded: 1,
      linesRemoved: 0,
      projectName: isHidden ? OBFUSCATED_NAME : projectName,
      fileName: isHidden ? '[hidden]' : path.basename(uri.fsPath),
      hidden: isHidden
    });

    this.totalChanges++;
    if (!this.uniqueFiles.has(fileKey)) {
      this.uniqueFiles.add(fileKey);
    }

    OUT.appendLine(`[${source}] ${path.basename(uri.fsPath)} — total: ${this.totalChanges}`);
    this.statusBar.setChangeCount(this.totalChanges);
    if (this.totalChanges <= 5) {
      vscode.window.setStatusBarMessage(`$(graph) GhostCommit: saved ${path.basename(uri.fsPath)}`, 2000);
    }
    this.checkFlushConditions();
  }

  private checkFlushConditions() {
    const config = vscode.workspace.getConfiguration('ghostcommit');
    const threshold = config.get<number>('changeThreshold', 10);
    const idleMinutes = config.get<number>('flushInterval', 30);

    if (this.totalChanges >= threshold) {
      this.flush();
      return;
    }

    const elapsed = (Date.now() - this.lastActivityTime) / 1000 / 60;
    if (elapsed >= idleMinutes && this.totalChanges > 0) {
      this.flush();
    }
  }

  private async flush() {
    const session = this.cache.getCurrentSession();
    if (!session || session.entries.length === 0) return;

    this.clearFlushTimer();
    this.uniqueFiles.clear();
    this.totalChanges = 0;

    try {
      const aiSummary = await this.ai.generateSummary(session.entries);
      const cfg = vscode.workspace.getConfiguration('ghostcommit');
      const mode = cfg.get<string>('commitMode', 'hybrid');

      let finalSummary = aiSummary;

      if (mode === 'generic') {
        const exts = [...new Set(session.entries.map(e => e.fileExt))].filter(Boolean).join(', ');
        finalSummary = `Coding session · ${session.entries.length} file(s) · ${exts || 'various'}`;
      } else if (mode === 'hybrid') {
        const timeout = new Promise<string | undefined>(r => setTimeout(() => r(undefined), 40000));
        const choice = await Promise.race([
          vscode.window.showInformationMessage(
            `ghostcommit commit: "${aiSummary}"`,
            { modal: false },
            'Accept',
            'Edit',
            'Use Generic'
          ),
          timeout
        ]);

        if (choice === 'Edit') {
          const custom = await vscode.window.showInputBox({
            prompt: 'chore: | feat: | fix: | refactor: | docs: | style: | test:',
            placeHolder: 'chore: update project dependencies',
            value: aiSummary,
            valueSelection: [0, aiSummary.length],
            password: false,
            ignoreFocusOut: false
          });
          if (custom && custom.trim()) {
            finalSummary = custom.trim();
          }
        } else if (choice === 'Use Generic' || !choice) {
          const exts = [...new Set(session.entries.map(e => e.fileExt))].filter(Boolean).join(', ');
          finalSummary = `Coding session · ${session.entries.length} file(s) · ${exts || 'various'}`;
        }
      }

      this.cache.commitSession(finalSummary);

      try {
        await this.shadowRepo.commitActivity(finalSummary, session.entries.length);
      } catch (err: any) {
        console.error('ghostcommit: Shadow commit failed', err?.message);
      }

      try {
        await this.profileUpdater.update();
      } catch (err: any) {
        const msg = `ghostcommit: Profile update failed - ${err?.message || err}`;
        console.error(msg);
      }

      this.cache.startNewSession();
    } catch (err) {
      console.error('ghostcommit: Flush failed', err);
    }

    this.startFlushTimer();
  }

  private startFlushTimer() {
    const config = vscode.workspace.getConfiguration('ghostcommit');
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
