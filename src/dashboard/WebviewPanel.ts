import * as vscode from 'vscode';
import { SessionCache } from '../tracker/SessionCache';

const log = vscode.window.createOutputChannel('VibeTracker Dashboard');

export class WebviewPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private cache: SessionCache,
  ) {}

  createOrShow() {
    log.appendLine('[createOrShow] entered');
    try {
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One);
        this.rebuildHtml();
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        'vibetracker.dashboard',
        'VibeTracker Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      this.panel.webview.onDidReceiveMessage(msg => {
        log.appendLine(`[onMessage] ${JSON.stringify(msg)}`);
        if (msg.type === 'setConfig') {
          vscode.workspace.getConfiguration('vibetracker')
            .update(msg.key, msg.val, vscode.ConfigurationTarget.Global)
            .then(() => this.rebuildHtml());
        }
      }, undefined, this.context.subscriptions);

      this.panel.onDidDispose(() => this.panel = undefined);
      this.rebuildHtml();
      log.appendLine('[createOrShow] done');
    } catch (err) {
      log.appendLine(`[createOrShow] ERROR: ${err}`);
    }
  }

  private rebuildHtml() {
    if (!this.panel) { log.appendLine('[rebuildHtml] no panel'); return; }
    log.appendLine('[rebuildHtml] building with fresh data');
    this.panel.webview.html = this.buildHtml();
    log.appendLine('[rebuildHtml] done');
  }

  private esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  private buildHtml(): string {
    const t = this.cache.getTodayStats();
    const total = this.cache.getTotalStats();
    const recent = this.cache.getRecentSessions(5);
    const allLang = this.cache.getActivityByLanguage();
    const cfg = vscode.workspace.getConfiguration('vibetracker');
    const threshold = cfg.get<number>('changeThreshold', 10);
    const interval = cfg.get<number>('flushInterval', 30);
    const template = cfg.get<string>('template', 'artistic');

    log.appendLine(`[buildHtml] threshold=${threshold} interval=${interval}`);

    const todayLangs = Object.entries(t.langs).map(([e, n]) =>
      `<tr><td>${this.esc(e||'?')}</td><td>${n}</td></tr>`
    ).join('');

    const allLangs = Object.entries(allLang).map(([e, d]) =>
      `<tr><td>${this.esc(e||'?')}</td><td>${d.saves}</td><td>${d.lines}</td></tr>`
    ).join('');

    const sessRows = recent.map(s => {
      const fileList = [...new Set(s.entries.map(e => e.fileName))].filter(Boolean).join(', ');
      const projectList = [...new Set(s.entries.map(e => e.projectName).filter(n => n !== '[private]'))].join(', ');
      const tooltip = `Files: ${fileList || '?'}\nProject: ${projectList || '?'}`;
      return `<tr title="${this.esc(tooltip)}" style="cursor:help"><td>${new Date(s.startTime).toLocaleString()}</td><td>${s.entries.length}</td><td>${this.esc(s.summary||'-')}</td></tr>`;
    }).join('');

    const projs = [...t.projects, ...t.hiddenProjects.map(() => '[private]')].join(', ') || '-';
    const tmplOpts = ['artistic','cyber','retro'].map(tm =>
      `<option value="${tm}"${tm===template?' selected':''}>${tm.charAt(0).toUpperCase()+tm.slice(1)}</option>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>VibeTracker</title></head>
<body style="background:#0d1117;color:#c9d1d9;font-family:-apple-system,system-ui,sans-serif;padding:20px">
<h1 style="color:#58a6ff">VibeTracker</h1>
<p style="color:#8b949e;font-size:12px">${new Date().toLocaleDateString('pt-BR')}</p>

<div style="background:#161b22;border:1px solid #1f6feb;border-radius:8px;padding:16px;margin-bottom:16px">
<h2 style="color:#58a6ff;font-size:13px;margin-top:0">Today Activity</h2>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">${t.saves}</div><div style="font-size:10px;color:#8b949e">CHANGES</div></div>
<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">${t.lines}</div><div style="font-size:10px;color:#8b949e">LINES</div></div>
<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">${t.projects.length+t.hiddenProjects.length}</div><div style="font-size:10px;color:#8b949e">PROJECTS</div></div>
</div>
${todayLangs?'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Language</th><th style="text-align:left;padding:6px 10px">Saves</th></tr>'+todayLangs+'</table>':'<p style="color:#484f58">No activity today</p>'}
<p style="font-size:11px;color:#8b949e">Projects: ${this.esc(projs)}</p>
</div>

<h2 style="font-size:13px;color:#8b949e">ALL TIME</h2>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">${total.totalSaves}</div><div style="font-size:10px;color:#8b949e">TOTAL CHANGES</div></div>
<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">${total.totalLines}</div><div style="font-size:10px;color:#8b949e">TOTAL LINES</div></div>
</div>

<h2 style="font-size:13px;color:#8b949e">LANGUAGES</h2>
${allLangs?'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Language</th><th style="text-align:left;padding:6px 10px">Saves</th><th style="text-align:left;padding:6px 10px">Lines</th></tr>'+allLangs+'</table>':'<p style="color:#484f58">No data</p>'}

<h2 style="font-size:13px;color:#8b949e">SETTINGS</h2>
<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px">
<div style="margin-bottom:14px">
<label style="font-size:12px;color:#8b949e">Flush after (changes)</label>
<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
<button id="btnMinus" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">-</button>
<span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">${threshold}</span>
<button id="btnPlus" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>
</div>
<label style="font-size:12px;color:#8b949e;display:block;margin-top:10px">Interval (min)</label>
<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
<button id="btnIntMinus" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">-</button>
<span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">${interval}</span>
<button id="btnIntPlus" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>
</div>
<label style="font-size:12px;color:#8b949e;display:block;margin-top:10px">Template</label>
<select id="selTemplate" style="background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;padding:6px 8px;font-size:12px;width:100%">${tmplOpts}</select>
</div>
</div>

<h2 style="font-size:13px;color:#8b949e">RECENT SESSIONS</h2>
${sessRows?'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Time</th><th style="text-align:left;padding:6px 10px">Files</th><th style="text-align:left;padding:6px 10px">Summary</th></tr>'+sessRows+'</table>':'<p style="color:#484f58">No sessions yet</p>'}

<p style="color:#484f58;font-size:10px;margin-top:20px">VibeTracker v0.1</p>
<script>
(function(){
  var api;
  try { api = acquireVsCodeApi(); } catch(e) {}
  function post(k,v) { if(api) api.postMessage({type:'setConfig',key:k,val:v}); }

  document.getElementById('btnMinus')?.addEventListener('click',function(){post('changeThreshold',${Math.max(1,threshold-1)});});
  document.getElementById('btnPlus')?.addEventListener('click',function(){post('changeThreshold',${threshold+1});});
  document.getElementById('btnIntMinus')?.addEventListener('click',function(){post('flushInterval',${Math.max(1,interval-5)});});
  document.getElementById('btnIntPlus')?.addEventListener('click',function(){post('flushInterval',${interval+5});});
  document.getElementById('selTemplate')?.addEventListener('change',function(){post('template',this.value);});
})();
</script>
</body>
</html>`;
  }
}
