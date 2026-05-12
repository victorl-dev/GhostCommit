import { TemplateRenderer, ActivityStats } from '../Generator';
import { JSDOM } from 'jsdom';

export class RetroTemplate implements TemplateRenderer {
  render(stats: ActivityStats, dom: JSDOM): string {
    const entries = Object.entries(stats.byLanguage);
    const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);
    const barWidth = 40;
    let bars = '';

    entries.forEach(([ext, data], i) => {
      const barHeight = Math.max(Math.round((data.lines / maxVal) * 14), 1);
      const x = 60 + i * 90;
      const blocks = Array.from({ length: barHeight }, (_, j) =>
        `<rect x="${x}" y="${236 - j * 14}" width="${barWidth}" height="12" fill="#33ff33" opacity="0.9" rx="1"/>`
      ).join('\n');

      const emptyBlocks = Array.from({ length: Math.max(14 - barHeight, 0) }, (_, j) =>
        `<rect x="${x}" y="${236 - (barHeight + j) * 14}" width="${barWidth}" height="12" fill="#1a331a" rx="1"/>`
      ).join('\n');

      bars += `${emptyBlocks}\n${blocks}\n`;
      bars += `<text x="${x + 20}" y="265" fill="#33ff33" font-family="monospace" font-size="9" text-anchor="middle">${ext}</text>`;
      bars += `<text x="${x + 20}" y="${236 - barHeight * 14 - 6}" fill="#00cc00" font-family="monospace" font-size="10" text-anchor="middle">${data.lines}</text>`;
    });

    return `
      <rect x="0" y="0" width="600" height="300" fill="#0d0d0d"/>
      <line x1="30" y1="30" x2="570" y2="30" stroke="#33ff33" stroke-width="1" opacity="0.3"/>
      <text x="30" y="25" fill="#33ff33" font-family="monospace" font-size="14" font-weight="bold">> VIBE_CODING.EXE</text>
      <text x="30" y="45" fill="#00cc00" font-family="monospace" font-size="10">> ${stats.sessions} sessions | ${stats.totalSaves} files | ${stats.totalLines} lines</text>
      ${bars}
      <text x="30" y="285" fill="#33ff33" font-family="monospace" font-size="8" opacity="0.7">> Last commit: ${stats.lastSummary || 'N/A'}</text>
      <text x="420" y="285" fill="#33ff33" font-family="monospace" font-size="8" opacity="0.5">[VibeTracker v0.1]</text>`;
  }
}
