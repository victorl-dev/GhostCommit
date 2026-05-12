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
        log.appendLine('[createOrShow] panel exists, revealing');
        this.panel.reveal(vscode.ViewColumn.One);
        this.pushData();
        return;
      }

      log.appendLine('[createOrShow] creating new webview panel');
      this.panel = vscode.window.createWebviewPanel(
        'vibetracker.dashboard',
        'VibeTracker Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      log.appendLine('[createOrShow] panel created, registering handlers');

      this.panel.webview.onDidReceiveMessage(
        msg => {
          log.appendLine(`[onDidReceiveMessage] received: ${JSON.stringify(msg)}`);
          this.onMessage(msg);
        },
        undefined,
        this.context.subscriptions
      );

      this.panel.onDidDispose(() => {
        log.appendLine('[onDidDispose] panel disposed');
        this.panel = undefined;
      });

      log.appendLine('[createOrShow] setting HTML');
      this.panel.webview.html = this.buildHtml();
      log.appendLine('[createOrShow] HTML set, pushing initial data');
      this.pushData();
      log.appendLine('[createOrShow] done');
    } catch (err) {
      log.appendLine(`[createOrShow] ERROR: ${err}`);
      vscode.window.showErrorMessage(`VibeTracker Dashboard error: ${err}`);
    }
  }

  private onMessage(msg: any) {
    log.appendLine(`[onMessage] processing: type=${msg.type} key=${msg.key} val=${msg.val}`);
    try {
      if (msg.type === 'setConfig') {
        const cf = vscode.workspace.getConfiguration('vibetracker');
        cf.update(msg.key, msg.val, vscode.ConfigurationTarget.Global).then(
          () => {
            log.appendLine(`[onMessage] config saved: ${msg.key}=${msg.val}`);
            this.pushData();
          },
          err => {
            log.appendLine(`[onMessage] config save ERROR: ${err}`);
          }
        );
      }
    } catch (err) {
      log.appendLine(`[onMessage] ERROR: ${err}`);
    }
  }

  private pushData() {
    try {
      if (!this.panel) {
        log.appendLine('[pushData] no panel, returning');
        return;
      }
      const t = this.cache.getTodayStats();
      const total = this.cache.getTotalStats();
      const recent = this.cache.getRecentSessions(5);
      const allLang = this.cache.getActivityByLanguage();
      const cfg = vscode.workspace.getConfiguration('vibetracker');

      const data = {
        type: 'refresh',
        today: t,
        total,
        recent: recent.map(s => ({
          time: new Date(s.startTime).toLocaleString(),
          files: s.entries.length,
          summary: s.summary || '-'
        })),
        langs: Object.entries(allLang).map(([e, d]) => ({ ext: e || '?', saves: d.saves, lines: d.lines })),
        threshold: cfg.get<number>('savesThreshold', 10),
        interval: cfg.get<number>('flushInterval', 30),
        template: cfg.get<string>('template', 'artistic'),
        projs: [...t.projects, ...t.hiddenProjects.map(() => '[private]')].join(', ') || '-'
      };
      log.appendLine(`[pushData] posting message: threshold=${data.threshold} interval=${data.interval}`);
      this.panel.webview.postMessage(data).then(
        result => log.appendLine(`[pushData] postMessage result: ${result}`),
        err => log.appendLine(`[pushData] postMessage ERROR: ${err}`)
      );
    } catch (err) {
      log.appendLine(`[pushData] ERROR: ${err}`);
    }
  }

  private esc(s: string) {
    try {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch { return s; }
  }

  private buildHtml(): string {
    log.appendLine('[buildHtml] building HTML');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>VibeTracker Dashboard</title>
</head>
<body style="background:#0d1117;color:#c9d1d9;font-family:-apple-system,system-ui,sans-serif;padding:20px">
  <div id="app">Loading...</div>
  <script>
    (function() {
      var api = null;
      try {
        api = acquireVsCodeApi();
        console.log('VT: acquireVsCodeApi OK');
      } catch(e) {
        console.error('VT: acquireVsCodeApi FAILED:', e.message);
      }
      console.log('VT: api is', api ? 'available' : 'null');

      function render(d) {
        console.log('VT: rendering data', JSON.stringify(d).substring(0,200));
        try {
          var tmplOpts = ['artistic','cyber','retro'].map(function(t) {
            return '<option value="'+t+'"'+(t===d.template?' selected':'')+'>'+t.charAt(0).toUpperCase()+t.slice(1)+'</option>';
          }).join('');

          var todayLangs = '';
          if (d.today && d.today.langs) {
            var keys = Object.keys(d.today.langs);
            for (var i = 0; i < keys.length; i++) {
              todayLangs += '<tr><td style="padding:6px 10px">'+(keys[i]||'?')+'</td><td style="padding:6px 10px">'+d.today.langs[keys[i]]+'</td></tr>';
            }
          }

          var allLangs = '';
          if (d.langs) {
            for (var i = 0; i < d.langs.length; i++) {
              allLangs += '<tr><td style="padding:6px 10px">'+d.langs[i].ext+'</td><td style="padding:6px 10px">'+d.langs[i].saves+'</td><td style="padding:6px 10px">'+d.langs[i].lines+'</td></tr>';
            }
          }

          var sess = '';
          if (d.recent) {
            for (var i = 0; i < d.recent.length; i++) {
              sess += '<tr><td style="padding:6px 10px">'+d.recent[i].time+'</td><td style="padding:6px 10px">'+d.recent[i].files+'</td><td style="padding:6px 10px">'+d.recent[i].summary+'</td></tr>';
            }
          }

          var ts = d.today ? d.today.saves : 0;
          var tl = d.today ? d.today.lines : 0;
          var tp = d.today ? ((d.today.projects?d.today.projects.length:0)+(d.today.hiddenProjects?d.today.hiddenProjects.length:0)) : 0;

          document.getElementById('app').innerHTML =
            '<h1 style="color:#58a6ff;font-size:20px;margin-bottom:4px">VibeTracker</h1>' +
            '<p style="color:#8b949e;font-size:12px;margin-bottom:20px">'+new Date().toLocaleDateString('pt-BR')+'</p>' +
            '<div style="background:#161b22;border:1px solid #1f6feb;border-radius:8px;padding:16px;margin-bottom:16px">' +
              '<h2 style="color:#58a6ff;font-size:13px;margin:0 0 12px 0">Today Activity</h2>' +
              '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">' +
                '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">'+ts+'</div><div style="font-size:10px;color:#8b949e">SAVES</div></div>' +
                '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">'+tl+'</div><div style="font-size:10px;color:#8b949e">LINES</div></div>' +
                '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">'+tp+'</div><div style="font-size:10px;color:#8b949e">PROJECTS</div></div>' +
              '</div>' +
              (todayLangs?'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Lang</th><th style="text-align:left;padding:6px 10px">Saves</th></tr>'+todayLangs+'</table>':'<p style="color:#484f58">No activity today</p>') +
              '<p style="font-size:11px;color:#8b949e;margin-top:8px">Projects: '+(d.projs||'-')+'</p>' +
            '</div>' +
            '<h2 style="font-size:13px;color:#8b949e;margin:20px 0 10px">ALL TIME</h2>' +
            '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">' +
              '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">'+(d.total?d.total.totalSaves:0)+'</div><div style="font-size:10px;color:#8b949e">TOTAL SAVES</div></div>' +
              '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#58a6ff">'+(d.total?d.total.totalLines:0)+'</div><div style="font-size:10px;color:#8b949e">TOTAL LINES</div></div>' +
            '</div>' +
            '<h2 style="font-size:13px;color:#8b949e;margin:20px 0 10px">LANGUAGES</h2>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Lang</th><th style="text-align:left;padding:6px 10px">Saves</th><th style="text-align:left;padding:6px 10px">Lines</th></tr>'+allLangs+'</table>' +
            '<h2 style="font-size:13px;color:#8b949e;margin:20px 0 10px">SETTINGS</h2>' +
            '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px">' +
              '<div style="margin-bottom:14px"><label style="font-size:12px;color:#8b949e">Threshold (saves)</label>' +
                '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">' +
                  '<button onclick="clickBtn(\'savesThreshold\','+(d.threshold-1)+')" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">-</button>' +
                  '<span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">'+d.threshold+'</span>' +
                  '<button onclick="clickBtn(\'savesThreshold\','+(d.threshold+1)+')" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>' +
                '</div></div>' +
              '<div style="margin-bottom:14px"><label style="font-size:12px;color:#8b949e">Interval (min)</label>' +
                '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">' +
                  '<button onclick="clickBtn(\'flushInterval\','+(d.interval-5)+')" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">-</button>' +
                  '<span style="font-size:18px;font-weight:700;color:#58a6ff;min-width:30px;text-align:center">'+d.interval+'</span>' +
                  '<button onclick="clickBtn(\'flushInterval\','+(d.interval+5)+')" style="background:#30363d;color:#c9d1d9;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px">+</button>' +
                '</div></div>' +
              '<div><label style="font-size:12px;color:#8b949e;display:block;margin-bottom:4px">Template</label>' +
                '<select onchange="clickBtn(\'template\',this.value)" style="background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;padding:6px 8px;font-size:12px;width:100%">'+tmplOpts+'</select></div>' +
            '</div>' +
            '<h2 style="font-size:13px;color:#8b949e;margin:20px 0 10px">RECENT SESSIONS</h2>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#8b949e;border-bottom:1px solid #30363d"><th style="text-align:left;padding:6px 10px">Time</th><th style="text-align:left;padding:6px 10px">Files</th><th style="text-align:left;padding:6px 10px">Summary</th></tr>'+sess+'</table>' +
            '<p style="color:#484f58;font-size:10px;margin-top:20px">VibeTracker v0.1 | VT: OK</p>';
          console.log('VT: render complete');
        } catch(e) {
          console.error('VT: render ERROR:', e.message);
          document.getElementById('app').innerHTML = 'Render error: ' + e.message;
        }
      }

      window.clickBtn = function(key, val) {
        console.log('VT: clickBtn', key, val);
        if (api) {
          api.postMessage({type:'setConfig', key:key, val:val});
          console.log('VT: message posted');
        } else {
          console.error('VT: api is null, cannot post');
        }
      };

      window.addEventListener('message', function(e) {
        console.log('VT: message received', e.data ? e.data.type : 'no data');
        if (e.data && e.data.type === 'refresh') {
          render(e.data);
        }
      });

      console.log('VT: initial render with empty data');
      render({ total:{totalSaves:0,totalLines:0}, today:{saves:0,lines:0,langs:{},projects:[],hiddenProjects:[]}, recent:[], langs:[], threshold:10, interval:30, template:'artistic', projs:'-' });
      console.log('VT: init complete, waiting for real data...');
    })();
  </script>
</body>
</html>`;
  }
}
