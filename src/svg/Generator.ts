import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import rough from 'roughjs';
import { ArtisticTemplate } from './templates/ArtisticTemplate';
import { CyberTemplate } from './templates/CyberTemplate';
import { RetroTemplate } from './templates/RetroTemplate';

export interface TemplateRenderer {
  render(stats: ActivityStats, dom: JSDOM): string;
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

  constructor(private context: vscode.ExtensionContext) {
    this.template = vscode.workspace.getConfiguration('vibetracker').get('template', 'artistic');
  }

  setTemplate(name: string) {
    this.template = name;
  }

  updateStats(stats: ActivityStats) {
    this.stats = stats;
  }

  private getRenderer(): TemplateRenderer {
    switch (this.template) {
      case 'cyber': return new CyberTemplate();
      case 'retro': return new RetroTemplate();
      default: return new ArtisticTemplate();
    }
  }

  async generate(): Promise<string> {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;
    const svgNs = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '600');
    svg.setAttribute('height', '300');
    svg.setAttribute('viewBox', '0 0 600 300');
    svg.setAttribute('xmlns', svgNs);

    const renderer = this.getRenderer();
    const content = renderer.render(this.stats, dom);

    if (this.template === 'artistic') {
      const rc = rough.svg(svg);
      const lines = this.stats.byLanguage;
      const entries = Object.entries(lines);
      const maxVal = Math.max(...entries.map(([, v]) => v.lines), 1);

      rc.rectangle(20, 20, 560, 260, { fill: '#1a1a2e', fillStyle: 'solid', roughness: 0.5 });

      this.drawTitle(dom, svg, 'VIBE CODING ACTIVITY', 30, 45, '#e94560');
      this.drawTitle(dom, svg, `Last: ${this.stats.lastSummary || 'N/A'}`, 30, 62, '#8899aa', 12);

      entries.forEach(([ext, data], i) => {
        const barHeight = Math.max((data.lines / maxVal) * 120, 20);
        const x = 50 + i * 110;
        const y = 250 - barHeight;
        const colors = ['#e94560', '#0f3460', '#16213e', '#533483', '#00b4d8', '#7209b7', '#f72585', '#4cc9f0'];

        rc.rectangle(x, y, 60, barHeight, {
          fill: colors[i % colors.length],
          fillStyle: 'cross-hatch',
          roughness: 1.5,
          stroke: colors[i % colors.length],
          strokeWidth: 0.5
        });

        this.drawTitle(dom, svg, `${ext} (${data.saves})`, x + 5, 275, '#ccc', 9);
        this.drawTitle(dom, svg, `${data.lines} lines`, x + 5, y - 5, '#e94560', 9);
      });
    } else {
      svg.innerHTML = content;
    }

    return new dom.window.XMLSerializer().serializeToString(svg);
  }

  private drawTitle(dom: JSDOM, svg: Element, text: string, x: number, y: number, color: string, size = 14) {
    const doc = dom.window.document;
    const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', x.toString());
    el.setAttribute('y', y.toString());
    el.setAttribute('fill', color);
    el.setAttribute('font-family', 'monospace');
    el.setAttribute('font-size', size.toString());
    el.textContent = text;
    svg.appendChild(el);
  }
}
