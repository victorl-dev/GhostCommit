import * as vscode from 'vscode';

export interface TemplateRenderer {
  render(stats: ActivityStats): string;
}

export interface ActivityStats {
  totalSaves: number;
  totalLines: number;
  sessions: number;
  byLanguage: Record<string, { saves: number; lines: number }>;
  lastSummary: string;
}

export class SVGGenerator {
  private template: string = 'artistic';
  private stats: ActivityStats = {
    totalSaves: 0,
    totalLines: 0,
    sessions: 0,
    byLanguage: {},
    lastSummary: ''
  };

  constructor(context: vscode.ExtensionContext) {
    this.template = vscode.workspace.getConfiguration('vibetracker').get('template', 'artistic');
  }

  setTemplate(name: string) {
    this.template = name;
  }

  updateStats(stats: ActivityStats) {
    this.stats = stats;
  }

  async generate(): Promise<string> {
    const t = this.template;

    const w = 600, h = 300;

    if (t === 'cyber') {
      return this.renderCyber(w, h);
    }
    if (t === 'retro') {
      return this.renderRetro(w, h);
    }
    return this.renderArtistic(w, h);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private renderArtistic(w: number, h: number): string {
    const { byLanguage, totalLines, sessions, totalSaves, lastSummary } = this.stats;
    const entries = Object.entries(byLanguage);
    const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);
    const colors = ['#e94560', '#0f3460', '#16213e', '#533483', '#00b4d8', '#7209b7', '#f72585', '#4cc9f0'];
    let bars = '';

    entries.forEach(([ext, data], i) => {
      const bh = Math.max((data.lines / maxVal) * 150, 20);
      const x = 50 + i * 110;
      const y = 230 - bh;
      const c = colors[i % colors.length];
      bars += `
        <rect x="${x}" y="${y}" width="60" height="${bh}" fill="${c}" stroke="${c}" stroke-width="0.5" rx="3" opacity="0.85"/>
        <line x1="${x}" y1="${y + bh}" x2="${x + 60}" y2="${y + bh}" stroke="#fff" stroke-width="0.3" stroke-dasharray="2,2"/>
        <text x="${x + 30}" y="${y - 5}" fill="${c}" font-family="monospace" font-size="9" text-anchor="middle" font-weight="bold">${data.lines}</text>
        <text x="${x + 30}" y="255" fill="#ccc" font-family="monospace" font-size="9" text-anchor="middle">${this.esc(ext)}</text>
        <text x="${x + 30}" y="267" fill="#888" font-family="monospace" font-size="8" text-anchor="middle">${data.saves} saves</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#1a1a2e" rx="8"/>
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#e94560" stroke-width="0.5" rx="8" opacity="0.3"/>
      <text x="25" y="30" fill="#e94560" font-family="monospace" font-size="16" font-weight="bold">VIBE CODING</text>
      <text x="25" y="48" fill="#8899aa" font-family="monospace" font-size="11">${totalSaves} saves · ${totalLines} lines · ${sessions} sessions</text>
      ${bars}
      <text x="25" y="285" fill="#555" font-family="monospace" font-size="9">Last: ${this.esc(lastSummary || 'N/A')}</text>
    </svg>`;
  }

  private renderCyber(w: number, h: number): string {
    const { byLanguage, totalLines, sessions, totalSaves, lastSummary } = this.stats;
    const entries = Object.entries(byLanguage);
    const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);
    const colors = ['#00f5d4', '#00bbf9', '#fee440', '#f15bb5', '#9b5de5', '#ff006e', '#8338ec', '#3a86ff'];
    let bars = '';

    entries.forEach(([ext, data], i) => {
      const bh = Math.max((data.lines / maxVal) * 180, 20);
      const x = 60 + i * 110;
      const y = 250 - bh;
      const c = colors[i % colors.length];
      bars += `
        <rect x="${x}" y="${y}" width="50" height="${bh}" fill="${c}" rx="4" opacity="0.9"/>
        <text x="${x + 25}" y="${y - 6}" fill="${c}" font-family="system-ui,sans-serif" font-size="11" text-anchor="middle" font-weight="600">${data.lines}</text>
        <text x="${x + 25}" y="275" fill="#8892b0" font-family="system-ui,sans-serif" font-size="10" text-anchor="middle">${this.esc(ext)}</text>
        <text x="${x + 25}" y="${y + bh + 14}" fill="#555" font-family="system-ui,sans-serif" font-size="9" text-anchor="middle">${data.saves} saves</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#0a192f" rx="12"/>
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#1e3a5f" stroke-width="1" rx="12"/>
      <text x="30" y="35" fill="#ccd6f6" font-family="system-ui,sans-serif" font-size="18" font-weight="700">⚡ VIBE CODING METRICS</text>
      <text x="30" y="55" fill="#64ffda" font-family="system-ui,sans-serif" font-size="11">${totalLines} lines · ${sessions} sessions · ${totalSaves} saves</text>
      ${bars}
      <text x="30" y="285" fill="#495670" font-family="system-ui,sans-serif" font-size="9">Last: ${this.esc(lastSummary || 'N/A')}</text>
    </svg>`;
  }

  private renderRetro(w: number, h: number): string {
    const { byLanguage, totalSaves, totalLines, sessions, lastSummary } = this.stats;
    const entries = Object.entries(byLanguage);
    const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);
    const barWidth = 40;
    let bars = '';

    entries.forEach(([ext, data], i) => {
      const barHeight = Math.max(Math.round((data.lines / maxVal) * 14), 1);
      const x = 60 + i * 90;
      for (let j = 0; j < 14; j++) {
        const filled = j < barHeight;
        bars += `<rect x="${x}" y="${236 - j * 14}" width="${barWidth}" height="12" fill="${filled ? '#33ff33' : '#1a331a'}" rx="1"/>`;
      }
      bars += `<text x="${x + 20}" y="265" fill="#33ff33" font-family="monospace" font-size="9" text-anchor="middle">${this.esc(ext)}</text>`;
      bars += `<text x="${x + 20}" y="${236 - barHeight * 14 - 6}" fill="#00cc00" font-family="monospace" font-size="10" text-anchor="middle">${data.lines}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#0d0d0d"/>
      <line x1="30" y1="30" x2="${w - 30}" y2="30" stroke="#33ff33" stroke-width="1" opacity="0.3"/>
      <text x="30" y="25" fill="#33ff33" font-family="monospace" font-size="14" font-weight="bold">> VIBE_CODING.EXE</text>
      <text x="30" y="45" fill="#00cc00" font-family="monospace" font-size="10">> ${sessions} sessions | ${totalSaves} files | ${totalLines} lines</text>
      ${bars}
      <text x="30" y="285" fill="#33ff33" font-family="monospace" font-size="8" opacity="0.7">> Last commit: ${this.esc(lastSummary || 'N/A')}</text>
      <text x="${w - 170}" y="285" fill="#33ff33" font-family="monospace" font-size="8" opacity="0.5">[VibeTracker v0.1]</text>
    </svg>`;
  }
}
