import * as vscode from 'vscode';
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
        { enableScripts: false, retainContextWhenHidden: true }
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
    const total = this.cache.getTotalStats();
    const today = this.cache.getTodayStats();
    const recentSessions = this.cache.getRecentSessions(5);

    const todayLangs = Object.entries(today.langs)
      .map(([ext, n]) => `<tr><td>${ext || '?'}</td><td>${n}</td></tr>`).join('');

    const totalLangs = Object.entries(stats.byLanguage)
      .map(([ext, data]) => `<tr><td>${ext || '?'}</td><td>${data.saves}</td><td>${data.lines}</td></tr>`).join('');

    const sessionRows = recentSessions.map(s => {
      const date = new Date(s.startTime).toLocaleString();
      return `<tr><td>${date}</td><td>${s.entries.length}</td><td>${this.esc(s.summary || 'pending...')}</td></tr>`;
    }).join('');

    const projects = today.projects.length > 0
      ? today.projects.join(', ') : '—';
    const hidden = today.hiddenProjects.length > 0
      ? `<span style="color:#e94560">🔒 ${today.hiddenProjects.length} hidden</span>` : '';

    this.panel.html = this.getHtml(total, today, todayLangs, totalLangs, sessionRows, projects, hidden);
  }

  private esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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

  private htmlHeader(): string {
    const csp = this.panel?.webview.cspSource || 'https:';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${csp}; img-src data: ${csp};">
  <title>VibeTracker Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #58a6ff; margin-bottom: 4px; }
    .subtitle { color: #8b949e; font-size: 12px; margin-bottom: 20px; }
    h2 { font-size: 13px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px; }
    .today-section { background: #161b22; border: 1px solid #1f6feb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .today-header { color: #58a6ff; font-size: 13px; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
    .stat-card { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: #58a6ff; }
    .stat-label { font-size: 10px; color: #8b949e; margin-top: 2px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
    th { text-align: left; padding: 6px 10px; border-bottom: 1px solid #30363d; color: #8b949e; font-weight: 600; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #21262d; }
    tr:hover td { background: #161b22; }
    .projects { font-size: 11px; color: #8b949e; margin-top: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-bottom: 12px; }
    .badge.active { background: #1b4123; color: #3fb950; }
    p.footer { color: #484f58; font-size: 10px; margin-top: 20px; }
  </style>
</head>
<body>`;
  }

  private htmlFooter(): string {
    return `<p class="footer">VibeTracker v0.1 — Data stored locally</p>
</body>
</html>`;
  }

  private getHtml(
    total: { totalSaves: number; totalLines: number },
    today: { saves: number; lines: number; langs: Record<string, number>; projects: string[]; hiddenProjects: string[] },
    todayLangs: string, totalLangs: string, sessionRows: string,
    projects: string, hidden: string
  ) {
    const body = `
  <h1>VibeTracker</h1>
  <div class="subtitle">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  <span class="badge active">● Live — tracking now</span>

  <div class="today-section">
    <div class="today-header">Today's Activity</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${today.saves}</div><div class="stat-label">Files Saved</div></div>
      <div class="stat-card"><div class="stat-value">${today.lines}</div><div class="stat-label">Lines Changed</div></div>
      <div class="stat-card"><div class="stat-value">${today.projects.length + today.hiddenProjects.length}</div><div class="stat-label">Projects</div></div>
    </div>
    ${todayLangs ? '<table><thead><tr><th>Language</th><th>Saves</th></tr></thead><tbody>' + todayLangs + '</tbody></table>' : '<p>No activity today yet</p>'}
    <div class="projects">Projects: ${projects} ${hidden}</div>
  </div>

  <h2>All Time</h2>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${total.totalSaves}</div><div class="stat-label">Files Saved</div></div>
    <div class="stat-card"><div class="stat-value">${total.totalLines}</div><div class="stat-label">Lines Changed</div></div>
  </div>

  <h2>Languages (All Time)</h2>
  <table><thead><tr><th>Language</th><th>Saves</th><th>Lines</th></tr></thead><tbody>${totalLangs}</tbody></table>

  <h2>Recent Sessions</h2>
  <table><thead><tr><th>Time</th><th>Files</th><th>Summary</th></tr></thead><tbody>${sessionRows}</tbody></table>`;

    return this.htmlHeader() + body + this.htmlFooter();
  }
}
