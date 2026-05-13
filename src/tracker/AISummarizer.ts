import { SessionEntry } from './SessionCache';

export class AISummarizer {
  async generateSummary(entries: SessionEntry[]): Promise<string> {
    const extCounts: Record<string, number> = {};
    for (const e of entries) {
      const ext = e.fileExt || '(unknown)';
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }
    const topExt = Object.entries(extCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([ext]) => ext);
    const totalFiles = entries.length;
    if (topExt.length === 0) return 'Coding session';
    return `Working on ${topExt.join(' and ')} files (${totalFiles} files)`;
  }
}
