import * as vscode from 'vscode';
import { FileMonitor } from './tracker/FileMonitor';
import { SessionCache } from './tracker/SessionCache';
import { AISummarizer } from './tracker/AISummarizer';
import { GitHubAuth } from './github/AuthProvider';
import { ShadowRepo } from './github/ShadowRepo';
import { ProfileUpdater } from './github/ProfileUpdater';
import { SVGGenerator } from './svg/Generator';
import { WebviewPanel } from './dashboard/WebviewPanel';
import { StatusBarManager } from './status/StatusBar';

let _output: vscode.OutputChannel;
let fileMonitor: FileMonitor | undefined;
let statusBar: StatusBarManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    _output = vscode.window.createOutputChannel('ghostcommit');
    _output.appendLine('Activating ghostcommit...');

    const cache = new SessionCache(context);
    const ai = new AISummarizer();
    const auth = new GitHubAuth();
    const shadowRepo = new ShadowRepo(auth);
    const svgGen = new SVGGenerator(context);
    const profileUpdater = new ProfileUpdater(auth, svgGen, cache);
    const webviewPanel = new WebviewPanel(context, cache);

    statusBar = new StatusBarManager();
    statusBar.show();

    fileMonitor = new FileMonitor(cache, ai, shadowRepo, profileUpdater, statusBar);

    const config = vscode.workspace.getConfiguration('ghostcommit');
    if (config.get<boolean>('autoStart', true)) {
      fileMonitor.start();
      _output.appendLine('Auto-start enabled — tracking began');
    } else {
      _output.appendLine('Auto-start disabled — awaiting manual start');
    }

    // Refresh profile README with latest template/data on activation
    profileUpdater.update().catch(() => {});

    _output.appendLine('ghostcommit activated successfully');
    _output.show(true);

    context.subscriptions.push(
      vscode.commands.registerCommand('ghostcommit.start', () => {
        fileMonitor?.start();
        statusBar?.setTracking(true);
        _output.appendLine('Manual start');
      }),
      vscode.commands.registerCommand('ghostcommit.stop', () => {
        fileMonitor?.stop();
        statusBar?.setTracking(false);
        _output.appendLine('Stopped');
      }),
      vscode.commands.registerCommand('ghostcommit.dashboard', () => {
        webviewPanel.createOrShow();
      }),
      vscode.commands.registerCommand('ghostcommit.setTemplate', async () => {
        const selected = await vscode.window.showQuickPick(
          [
            { label: 'Ghost', description: 'Dark blue theme with compact bars', id: 'ghost' },
            { label: 'Wraith', description: 'Dark green theme with compact bars', id: 'wraith' },
            { label: 'Shadow', description: 'Dark purple theme with compact bars', id: 'shadow' }
          ],
          { placeHolder: 'Select a template for your profile SVG' }
        );
        if (selected) {
          const cf = vscode.workspace.getConfiguration('ghostcommit');
          await cf.update('template', selected.id, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`ghostcommit: Template set to ${selected.label}`);
        }
      }),
      vscode.commands.registerCommand('ghostcommit.status', async () => {
        const isTracking = fileMonitor?.isRunning() ?? false;
        const sessionCount = cache.getSessionCount();
        const lastCommit = shadowRepo.getLastCommitInfo();
        const blacklist = vscode.workspace.getConfiguration('ghostcommit').get<string[]>('projectBlacklist', []);
        const message = [
          `Status: ${isTracking ? '$(check) Tracking' : '$(circle-slash) Paused'}`,
          `Sessions tracked: ${sessionCount}`,
          lastCommit ? `Last commit: ${lastCommit}` : 'No commits yet',
          `Blacklisted: ${blacklist.length > 0 ? blacklist.length + ' path(s)' : 'none'}`
        ].join('\n');
        vscode.window.showInformationMessage(message);
      }),
      vscode.commands.registerCommand('ghostcommit.toggleBlacklist', async () => {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders || wsFolders.length === 0) {
          vscode.window.showWarningMessage('ghostcommit: No workspace folders open.');
          return;
        }
        const cf = vscode.workspace.getConfiguration('ghostcommit');
        const blacklist = cf.get<string[]>('projectBlacklist', []);
        const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
        const folderItems = wsFolders.map(f => ({
          label: `${f.name} (${f.uri.fsPath})`,
          description: f.uri.fsPath,
          picked: blacklist.some(b => norm(b) === norm(f.uri.fsPath))
        }));
        const selected = await vscode.window.showQuickPick(folderItems, {
          placeHolder: 'Toggle projects to obfuscate (path-based)',
          canPickMany: true
        });
        if (!selected) return;
        let newBlacklist = [...blacklist];
        for (const s of selected) {
          const pn = norm(s.description);
          const idx = newBlacklist.findIndex(b => norm(b) === pn);
          if (idx >= 0) newBlacklist.splice(idx, 1);
          else newBlacklist.push(s.description);
        }
        await cf.update('projectBlacklist', newBlacklist, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`ghostcommit: Blacklist updated — ${newBlacklist.length} path(s) hidden`);
      }),
      vscode.commands.registerCommand('ghostcommit.daily', () => {
        const today = cache.getTodayStats();
        const totalSaves = cache.getTotalStats();
        const langs = Object.entries(today.langs)
          .sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(([ext, n]) => `${ext} (${n})`).join(', ');
        const projs = [...today.projects, ...today.hiddenProjects.map(() => '[private]')];
        const msg = [
          `📅 ${new Date().toLocaleDateString('pt-BR')}`,
          `📁 ${today.saves} saves · ${today.lines} lines · ${projs.length} project(s)`,
          langs ? `🔤 ${langs}` : '',
          `📊 All time: ${totalSaves.totalSaves} saves · ${totalSaves.totalLines} lines`
        ].filter(Boolean).join('\n');
        vscode.window.showInformationMessage(msg);
        _output.appendLine(`Daily summary: ${today.saves} saves, ${today.lines} lines`);
      }),
      vscode.commands.registerCommand('ghostcommit.testDashboard', () => {
        _output.appendLine('=== DASHBOARD DIAGNOSTIC ===');
        try {
          const panel = vscode.window.createWebviewPanel(
            'ghostcommit.test', 'ghostcommit Test',
            vscode.ViewColumn.One,
            { enableScripts: true }
          );
          panel.webview.html = '<!DOCTYPE html><html><body><h1 style="color:green">GhostCommit Test OK</h1><p>If you see this, webviews work.</p></body></html>';
          _output.appendLine('Test webview created successfully');
          _output.appendLine(`cspSource: ${panel.webview.cspSource}`);
          vscode.window.showInformationMessage('ghostcommit: Test panel opened');
        } catch (err) {
          _output.appendLine(`Test webview FAILED: ${err}`);
          vscode.window.showErrorMessage(`ghostcommit webview error: ${err}`);
        }
      }),
      vscode.commands.registerCommand('ghostcommit.setupReadme', async () => {
        try {
          await auth.login();
          await profileUpdater.setupReadme();
        } catch (err) {
          vscode.window.showErrorMessage(`ghostcommit: README setup failed - ${err}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ghostcommit.template')) {
          svgGen.setTemplate(vscode.workspace.getConfiguration('ghostcommit').get('template', 'ghost'));
        }
        if (e.affectsConfiguration('ghostcommit.autoStart')) {
          const auto = vscode.workspace.getConfiguration('ghostcommit').get<boolean>('autoStart', true);
          if (auto) fileMonitor?.start();
          else fileMonitor?.stop();
        }
      })
    );

    showOnboarding(context, auth, shadowRepo, profileUpdater);
  } catch (err) {
    const msg = `Activation error: ${err}`;
    if (_output) _output.appendLine(msg);
    vscode.window.showErrorMessage(`ghostcommit: ${msg}`);
  }
}

export function deactivate() {
  try {
    fileMonitor?.stop();
    statusBar?.dispose();
    if (_output) _output.appendLine('ghostcommit deactivated');
  } catch {}
}

async function showOnboarding(
  context: vscode.ExtensionContext,
  auth: GitHubAuth,
  shadowRepo: ShadowRepo,
  profileUpdater: ProfileUpdater
) {
  const hasOnboarded = context.globalState.get<boolean>('ghostcommit.onboarded');
  if (hasOnboarded) return;

  const login = await vscode.window.showInformationMessage(
    'ghostcommit: Login with GitHub to enable profile updates?',
    'Login',
    'Skip'
  );
  if (login === 'Login') {
    try {
      await auth.login();
      const repoSetup = await vscode.window.showInformationMessage(
        'ghostcommit: Create shadow repo for activity tracking?',
        'Create',
        'Skip'
      );
      if (repoSetup === 'Create') {
        await shadowRepo.ensureRepo();
      }
      await context.globalState.update('ghostcommit.onboarded', true);
      vscode.window.showInformationMessage('ghostcommit: All set! Start coding and your profile will update automatically.');
    } catch (err) {
      vscode.window.showErrorMessage(`ghostcommit: GitHub setup failed - ${err}`);
    }
  }
}
