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

let fileMonitor: FileMonitor | undefined;
let statusBar: StatusBarManager | undefined;

export function activate(context: vscode.ExtensionContext) {
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
  fileMonitor.start();

  context.subscriptions.push(
    vscode.commands.registerCommand('vibetracker.start', () => {
      fileMonitor?.start();
      statusBar?.setTracking(true);
    }),
    vscode.commands.registerCommand('vibetracker.stop', () => {
      fileMonitor?.stop();
      statusBar?.setTracking(false);
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
        const config = vscode.workspace.getConfiguration('vibetracker');
        await config.update('template', selected.id, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`VibeTracker: Template set to ${selected.label}`);
      }
    }),
    vscode.commands.registerCommand('vibetracker.status', async () => {
      const isTracking = fileMonitor?.isRunning() ?? false;
      const sessionCount = cache.getSessionCount();
      const lastCommit = shadowRepo.getLastCommitInfo();
      const message = [
        `Status: ${isTracking ? '$(check) Tracking' : '$(circle-slash) Paused'}`,
        `Sessions tracked: ${sessionCount}`,
        lastCommit ? `Last commit: ${lastCommit}` : 'No commits yet'
      ].join('\n');
      vscode.window.showInformationMessage(message);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vibetracker.template')) {
        svgGen.setTemplate(vscode.workspace.getConfiguration('vibetracker').get('template', 'artistic'));
      }
    })
  );

  showOnboarding(context, auth, shadowRepo, profileUpdater);
}

export function deactivate() {
  fileMonitor?.stop();
  statusBar?.dispose();
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
