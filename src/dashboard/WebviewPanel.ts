import * as vscode from 'vscode';
import { SessionCache } from '../tracker/SessionCache';
import { SVGGenerator } from '../svg/Generator';

export class WebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private msgDisposable: vscode.Disposable | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private cache: SessionCache,
    private svgGen: SVGGenerator
  ) {}

  createOrShow() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'vibetracker.dashboard',
      'VibeTracker Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.onDidDispose(() => {
      this.msgDisposable?.dispose();
      this.panel = undefined;
    });
    this.msgDisposable = this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    this.refresh();
  }

  private refresh() {
    if (this.panel) this.panel.webview.html = this.buildHtml();
  }

  private handleMessage(msg: any) {
    const cf = vscode.workspace.getConfiguration('vibetracker');
    if (msg.command === 'setThreshold') {
      cf.update('savesThreshold', msg.value, vscode.ConfigurationTarget.Global);
    } else if (msg.command === 'setInterval') {
      cf.update('flushInterval', msg.value, vscode.ConfigurationTarget.Global);
    } else if (msg.command === 'setTemplate') {
      cf.update('template', msg.value, vscode.ConfigurationTarget.Global);
    }
  }

  private esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private buildHtml(): string {
    const t = this.cache.getTodayStats();
    const total = this.cache.getTotalStats();
    const recent = this.cache.getRecentSessions(5);
    const allLang = this.cache.getActivityByLanguage();
    const cfg = vscode.workspace.getConfiguration('vibetracker');
    const threshold = cfg.get<number>('savesThreshold', 10);
    const interval = cfg.get<number>('flushInterval', 30);
    const template = cfg.get<string>('template', 'artistic');

    const todayLangs = Object.entries(t.langs).map(([e, n]) =>
      `<tr><td>${this.esc(e || '?')}</td><td>${n}</td></tr>`
    ).join('');

    const allLangs = Object.entries(allLang).map(([e, d]) =>
      `<tr><td>${this.esc(e || '?')}</td><td>${d.saves}</td><td>${d.lines}</td></tr>`
    ).join('');

    const sessions = recent.map(s =>
      `<tr><td>${new Date(s.startTime).toLocaleString()}</td><td>${s.entries.length}</td><td>${this.esc(s.summary || '-')}</td></tr>`
    ).join('');

    const projs = [...t.projects, ...t.hiddenProjects.map(() => '[private]')].join(', ') || '-';

    const tmplOpts = ['artistic', 'cyber', 'retro'].map(tmpl =>
      `<option value="${tmpl}"${tmpl === template ? ' selected' : ''}>${tmpl.charAt(0).toUpperCase() + tmpl.slice(1)}</option>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>VibeTracker Dashboard</title>
</head>
<body style="background:#0d1117;color:#c9d1d9;font-family:-apple-system,system-ui,sans-serif;padding:20px">

  <script>
    (function() {
      var api = window.__vt;
      if (!api) { try { api = acquireVsCodeApi(); window.__vt = api; } catch(e) {} }
      window.update = function(k,v) {
        if (api) api.postMessage({command:k,value:v});
      };
    })();
  </script>

  <h1 style="color:#58a6ff;font-size:20px;margin-bottom:4px">VibeTracker</h1>
  <p style="color:#8b949e;font-size:12px;margin-bottom:20px">${new Date().toLocaleDateString('pt-BR')}</p>

  <div style="background:#161b22;border:1px solid #1f6feb;border-radius:8px;padding:16px;margin-bottom:16px">
    <h2 style="color:#58a6ff;font-size:13px;margin:0 0 12px 0;text-transform:uppercase">Today's Activity</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#58a6ff">${t.saves}</div>
        <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Saves</div>
      </div>
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#58a6ff">${t.lines}</div>
        <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Lines</div>
      </div>
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#58a6ff">${t.projects.length + t.hiddenProjects.length}</div>
        <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Projects</div>
      </div>
    </div>
    ${todayLangs ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Language</th><th style="text-align:left;padding:6px 10px">Saves</th></tr>' + todayLangs + '</table>' : '<p style="color:#484f58">No activity today</p>'}
    <p style="font-size:11px;color:#8b949e;margin-top:8px">Projects: ${this.esc(projs)}</p>
  </div>

  <h2 style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px">All Time</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:700;color:#58a6ff">${total.totalSaves}</div>
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Total Saves</div>
    </div>
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:700;color:#58a6ff">${total.totalLines}</div>
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Total Lines</div>
    </div>
  </div>

  <h2 style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px">Languages</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Language</th><th style="text-align:left;padding:6px 10px">Saves</th><th style="text-align:left;padding:6px 10px">Lines</th></tr>
    ${allLangs}
  </table>

  <h2 style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px">Settings</h2>
  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px">

    <div style="margin-bottom:14px">
      <label style="font-size:12px;color:#8b949e">Auto-commit threshold (saves)</label>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <button onclick="update('setThreshold',${Math.max(1,threshold-1)})" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">−</button>
        <span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">${threshold}</span>
        <button onclick="update('setThreshold',${threshold+1})" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <label style="font-size:12px;color:#8b949e">Idle flush interval (minutes)</label>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <button onclick="update('setInterval',${Math.max(1,interval-5)})" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">−</button>
        <span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">${interval}</span>
        <button onclick="update('setInterval',${interval+5})" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>
      </div>
    </div>

    <div>
      <label style="font-size:12px;color:#8b949e;display:block;margin-bottom:4px">SVG Template</label>
      <select onchange="update('setTemplate',this.value)" style="background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;padding:6px 8px;font-size:12px;width:100%">
        ${tmplOpts}
      </select>
    </div>
  </div>

  <h2 style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px">Recent Sessions</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Time</th><th style="text-align:left;padding:6px 10px">Files</th><th style="text-align:left;padding:6px 10px">Summary</th></tr>
    ${sessions}
  </table>

  <p style="color:#484f58;font-size:10px;margin-top:20px">VibeTracker v0.1 — Data stored locally</p>
</body>
</html>`;
  }
}
