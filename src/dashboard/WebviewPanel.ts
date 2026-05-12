import * as vscode from 'vscode';
import * as path from 'path';
import { SessionCache } from '../tracker/SessionCache';
import { SVGGenerator, ActivityStats } from '../svg/Generator';

export class WebviewPanel {
  public static readonly viewType = 'vibetracker.dashboard';
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private cache: SessionCache,
    private svgGen: SVGGenerator
  ) {}

  createOrShow() {
    try {
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Beside);
        this.updateContent();
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        WebviewPanel.viewType,
        'VibeTracker Dashboard',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          retainContextWhenHidden: true
        }
      );

      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.onDidChangeViewState(() => {
        if (this.panel?.visible) this.updateContent();
      });

      this.updateContent();
    } catch (err) {
      vscode.window.showErrorMessage(`VibeTracker Dashboard error: ${err}`);
    }
  }

  private updateContent() {
    if (!this.panel) return;

    const stats = this.getStats();
    const recentSessions = this.cache.getRecentSessions(5);
    const byLang = this.cache.getActivityByLanguage();
    const totalStats = this.cache.getTotalStats();

    const langRows = Object.entries(byLang)
      .map(([ext, data]) =>
        `<tr><td>${ext || '?'}</td><td>${data.saves}</td><td>${data.lines}</td></tr>`
      ).join('');

    const sessionRows = recentSessions
      .map(s => {
        const date = new Date(s.startTime).toLocaleString();
        return `<tr><td>${date}</td><td>${s.entries.length}</td><td>${s.summary || 'pending...'}</td></tr>`;
      }).join('');

    this.panel.html = this.getHtml(stats, langRows, sessionRows, totalStats);
  }

  private getStats(): ActivityStats {
    const byLang = this.cache.getActivityByLanguage();
    const total = this.cache.getTotalStats();
    const recent = this.cache.getRecentSessions(1);
    return {
      totalSaves: total.totalSaves,
      totalLines: total.totalLines,
      sessions: this.cache.getSessionCount(),
      byLanguage: byLang,
      lastSummary: recent[0]?.summary || 'No activity yet'
    };
  }

  private getHtml(stats: ActivityStats, langRows: string, sessionRows: string, total: { totalSaves: number; totalLines: number }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:;">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #58a6ff; margin-bottom: 16px; }
    h2 { font-size: 14px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #58a6ff; }
    .stat-label { font-size: 11px; color: #8b949e; margin-top: 4px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #30363d; color: #8b949e; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #21262d; }
    tr:hover td { background: #161b22; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-bottom: 16px; }
    .status.active { background: #1b4123; color: #3fb950; }
    .status.inactive { background: #41211b; color: #f85149; }
  </style>
</head>
<body>
  <h1>VibeTracker Dashboard</h1>
  <div class="status active">● Active - Tracking in progress</div>

  <h2>Overview</h2>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${total.totalSaves}</div><div class="stat-label">Files Saved</div></div>
    <div class="stat-card"><div class="stat-value">${total.totalLines}</div><div class="stat-label">Lines Changed</div></div>
    <div class="stat-card"><div class="stat-value">${stats.sessions}</div><div class="stat-label">Sessions</div></div>
  </div>

  <h2>Languages</h2>
  <table><thead><tr><th>Language</th><th>Saves</th><th>Lines</th></tr></thead><tbody>${langRows}</tbody></table>

  <h2>Recent Sessions</h2>
  <table><thead><tr><th>Time</th><th>Files</th><th>Summary</th></tr></thead><tbody>${sessionRows}</tbody></table>

  <p style="color:#484f58;font-size:10px;margin-top:20px">VibeTracker v0.1 - Data stored locally in extension storage</p>
</body>
</html>`;
  }
}
