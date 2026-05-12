import * as vscode from 'vscode';
import { GoogleGenAI } from '@google/genai';
import { SessionEntry } from './SessionCache';

export class AISummarizer {
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  private async ensureClient() {
    if (this.client) return;
    this.apiKey = await this.context.secrets.get('vibetracker.geminiKey') || null;
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async generateSummary(entries: SessionEntry[]): Promise<string> {
    await this.ensureClient();
    if (!this.client || !this.apiKey) {
      return this.fallbackSummary(entries);
    }

    try {
      const extCounts = this.countByExt(entries);
      const totalLines = entries.reduce((s, e) => s + e.linesAdded, 0);
      const projects = [...new Set(entries.map(e => e.projectName))];

      const prompt = [
        'Generate a short, professional commit message (max 15 words) describing the coding activity. Be specific and natural.',
        'Data:',
        `- Files changed: ${entries.length}`,
        `- Lines changed: ~${totalLines}`,
        `- Languages: ${Object.entries(extCounts).map(([ext, n]) => `${ext} (${n})`).join(', ')}`,
        `- Projects: ${projects.join(', ')}`,
        'Rules:',
        '- Max 15 words',
        '- Start with verb (-ing form, e.g. "Refining", "Building", "Fixing")',
        '- No quotes or prefixes like "Summary:"',
        '- Example: "Refining authentication flow and API integration"'
      ].join('\n');

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      return response.text?.trim() || this.fallbackSummary(entries);
    } catch {
      return this.fallbackSummary(entries);
    }
  }

  private fallbackSummary(entries: SessionEntry[]): string {
    const extCounts = this.countByExt(entries);
    const topExt = Object.entries(extCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([ext]) => ext);

    const totalLines = entries.reduce((s, e) => s + e.linesAdded, 0);
    if (topExt.length === 0) return 'Coding session';
    return `Working on ${topExt.join(' and ')} files (${totalLines}+ lines changed)`;
  }

  private countByExt(entries: SessionEntry[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      const ext = e.fileExt || '(unknown)';
      counts[ext] = (counts[ext] || 0) + 1;
    }
    return counts;
  }
}
