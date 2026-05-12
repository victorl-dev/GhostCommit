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
    _output = vscode.window.createOutputChannel('VibeTracker');
    _output.appendLine('Activating VibeTracker...');

    const cache = new SessionCache(context);
    const ai = new AISummarizer(context);
    const auth = new GitHubAuth();
    const shadowRepo = new ShadowRepo(auth);
    const svgGen = new SVGGenerator(context);
    const profileUpdater = new ProfileUpdater(auth, svgGen);
    const webviewPanel = new WebviewPanel(context, cache, svgGen);

    statusBar = new StatusBarManager();
    statusBar.show();

    fileMonitor = new FileMonitor(cache, ai, shadowRepo, profileUpdater, statusBar);

    const config = vscode.workspace.getConfiguration('vibetracker');
    if (config.get<boolean>('autoStart', true)) {
      fileMonitor.start();
      _output.appendLine('Auto-start enabled — tracking began');
    } else {
      _output.appendLine('Auto-start disabled — awaiting manual start');
    }

    _output.appendLine('VibeTracker activated successfully');
    _output.show(true);

    context.subscriptions.push(
      vscode.commands.registerCommand('vibetracker.start', () => {
        fileMonitor?.start();
        statusBar?.setTracking(true);
        _output.appendLine('Manual start');
      }),
      vscode.commands.registerCommand('vibetracker.stop', () => {
        fileMonitor?.stop();
        statusBar?.setTracking(false);
        _output.appendLine('Stopped');
      }),
      vscode.commands.registerCommand('vibetracker.dashboard', () => {
        webviewPanel.createOrShow();
      }),
      vscode.commands.registerCommand('vibetracker.setApiKey', async () => {
        const key = await vscode.window.showInputBox({
          prompt: 'Enter your Gemini API Key (from Google AI Studio)',
          password: true,
          placeHolder: 'AIza...'
        });
        if (key) {
          await context.secrets.store('vibetracker.geminiKey', key);
          ai.setApiKey(key);
          _output.appendLine('API Key saved');
          vscode.window.showInformationMessage('VibeTracker: Gemini API Key saved securely!');
        }
      }),
      vscode.commands.registerCommand('vibetracker.setTemplate', async () => {
        const selected = await vscode.window.showQuickPick(
          [
            { label: 'Artistic (Hand-drawn)', description: 'Rough.js sketchy style charts', id: 'artistic' },
            { label: 'Cyber-Minimalist', description: 'Clean modern SVG design', id: 'cyber' },
            { label: 'Retro Terminal', description: 'ASCII/pixel art style', id: 'retro' }
          ],
          { placeHolder: 'Select a template for your profile SVG' }
        );
        if (selected) {
          const cf = vscode.workspace.getConfiguration('vibetracker');
          await cf.update('template', selected.id, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`VibeTracker: Template set to ${selected.label}`);
        }
      }),
      vscode.commands.registerCommand('vibetracker.status', async () => {
        const isTracking = fileMonitor?.isRunning() ?? false;
        const sessionCount = cache.getSessionCount();
        const lastCommit = shadowRepo.getLastCommitInfo();
        const blacklist = vscode.workspace.getConfiguration('vibetracker').get<string[]>('projectBlacklist', []);
        const message = [
          `Status: ${isTracking ? '$(check) Tracking' : '$(circle-slash) Paused'}`,
          `Sessions tracked: ${sessionCount}`,
          lastCommit ? `Last commit: ${lastCommit}` : 'No commits yet',
          `Blacklisted: ${blacklist.length > 0 ? blacklist.length + ' path(s)' : 'none'}`
        ].join('\n');
        vscode.window.showInformationMessage(message);
      }),
      vscode.commands.registerCommand('vibetracker.toggleBlacklist', async () => {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders || wsFolders.length === 0) {
          vscode.window.showWarningMessage('VibeTracker: No workspace folders open.');
          return;
        }
        const cf = vscode.workspace.getConfiguration('vibetracker');
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
        vscode.window.showInformationMessage(`VibeTracker: Blacklist updated — ${newBlacklist.length} path(s) hidden`);
      }),
      vscode.commands.registerCommand('vibetracker.setupReadme', async () => {
        try {
          await auth.login();
          await profileUpdater.setupReadme();
        } catch (err) {
          vscode.window.showErrorMessage(`VibeTracker: README setup failed - ${err}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('vibetracker.template')) {
          svgGen.setTemplate(vscode.workspace.getConfiguration('vibetracker').get('template', 'artistic'));
        }
        if (e.affectsConfiguration('vibetracker.autoStart')) {
          const auto = vscode.workspace.getConfiguration('vibetracker').get<boolean>('autoStart', true);
          if (auto) fileMonitor?.start();
          else fileMonitor?.stop();
        }
      })
    );

    showOnboarding(context, auth, shadowRepo, profileUpdater);
  } catch (err) {
    const msg = `Activation error: ${err}`;
    if (_output) _output.appendLine(msg);
    vscode.window.showErrorMessage(`VibeTracker: ${msg}`);
  }
}

export function deactivate() {
  try {
    fileMonitor?.stop();
    statusBar?.dispose();
    if (_output) _output.appendLine('VibeTracker deactivated');
  } catch {}
}

async function showOnboarding(
  context: vscode.ExtensionContext,
  auth: GitHubAuth,
  shadowRepo: ShadowRepo,
  profileUpdater: ProfileUpdater
) {
  const hasOnboarded = context.globalState.get<boolean>('vibetracker.onboarded');
  if (hasOnboarded) return;

  const setupKey = await vscode.window.showInformationMessage(
    'VibeTracker: Configure your Gemini API key to get started.',
    'Set API Key',
    'Later'
  );
  if (setupKey === 'Set API Key') {
    await vscode.commands.executeCommand('vibetracker.setApiKey');
  }

  const login = await vscode.window.showInformationMessage(
    'VibeTracker: Login with GitHub to enable profile updates?',
    'Login',
    'Skip'
  );
  if (login === 'Login') {
    try {
      await auth.login();
      const repoSetup = await vscode.window.showInformationMessage(
        'VibeTracker: Create shadow repo for activity tracking?',
        'Create',
        'Skip'
      );
      if (repoSetup === 'Create') {
        await shadowRepo.ensureRepo();
      }
      await context.globalState.update('vibetracker.onboarded', true);
      vscode.window.showInformationMessage('VibeTracker: All set! Start coding and your profile will update automatically.');
    } catch (err) {
      vscode.window.showErrorMessage(`VibeTracker: GitHub setup failed - ${err}`);
    }
  }
}
