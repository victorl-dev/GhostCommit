import { TemplateRenderer, ActivityStats } from '../Generator';
import { JSDOM } from 'jsdom';

export class CyberTemplate implements TemplateRenderer {
  render(stats: ActivityStats, dom: JSDOM): string {
    const doc = dom.window.document;
    const svgNs = 'http://www.w3.org/2000/svg';
    const entries = Object.entries(stats.byLanguage);
    const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);
    let bars = '';

    entries.forEach(([ext, data], i) => {
      const barHeight = Math.max((data.lines / maxVal) * 180, 20);
      const x = 60 + i * 110;
      const y = 250 - barHeight;
      const colors = ['#00f5d4', '#00bbf9', '#fee440', '#f15bb5', '#9b5de5', '#ff006e', '#8338ec', '#3a86ff'];
      bars += `
        <rect x="${x}" y="${y}" width="50" height="${barHeight}" fill="${colors[i % colors.length]}" rx="4" opacity="0.9"/>
        <text x="${x + 25}" y="275" fill="#8892b0" font-family="system-ui,sans-serif" font-size="10" text-anchor="middle">${ext}</text>
        <text x="${x + 25}" y="${y - 6}" fill="${colors[i % colors.length]}" font-family="system-ui,sans-serif" font-size="11" text-anchor="middle" font-weight="600">${data.lines}</text>
        <text x="${x + 25}" y="${y + barHeight + 14}" fill="#556" font-family="system-ui,sans-serif" font-size="9" text-anchor="middle">${data.saves} saves</text>`;
    });

    return `
      <rect x="0" y="0" width="600" height="300" fill="#0a192f" rx="12"/>
      <rect x="1" y="1" width="598" height="298" fill="none" stroke="#1e3a5f" stroke-width="1" rx="12"/>
      <text x="30" y="35" fill="#ccd6f6" font-family="system-ui,sans-serif" font-size="18" font-weight="700">⚡ VIBE CODING METRICS</text>
      <text x="30" y="55" fill="#64ffda" font-family="system-ui,sans-serif" font-size="11">~${stats.totalLines} lines · ${stats.sessions} sessions · ${stats.totalSaves} saves</text>
      ${bars}
      <text x="30" y="285" fill="#495670" font-family="system-ui,sans-serif" font-size="9">Last: ${stats.lastSummary || 'N/A'}</text>`;
  }
}
