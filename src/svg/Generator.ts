import * as vscode from 'vscode';

export interface ActivityStats {
  totalSaves: number;
  totalLines: number;
  sessions: number;
  byLanguage: Record<string, { saves: number; lines: number }>;
  lastSummary: string;
  projects: string[];
  lastFile: string;
}

const FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Noto Sans,sans-serif';
const MONO = 'SFMono-Regular,Consolas,Liberation Mono,monospace';
const W = 550;

const COL: Record<string, {c:string;l:string}> = {
  '.ts':{c:'#3178C6',l:'TS'},'.tsx':{c:'#3178C6',l:'TS'},'.js':{c:'#F7DF1E',l:'JS'},'.jsx':{c:'#F7DF1E',l:'JS'},
  '.py':{c:'#3572A5',l:'PY'},'.rs':{c:'#DEA584',l:'RS'},'.go':{c:'#00ADD8',l:'GO'},'.java':{c:'#B07219',l:'JV'},
  '.kt':{c:'#A97BFF',l:'KT'},'.swift':{c:'#F05138',l:'SW'},'.dart':{c:'#00B4AB',l:'DT'},'.rb':{c:'#CC342D',l:'RB'},
  '.php':{c:'#4F5D95',l:'PHP'},'.cs':{c:'#178600',l:'CS'},'.vue':{c:'#41B883',l:'VU'},'.svelte':{c:'#FF3E00',l:'SV'},
  '.css':{c:'#563D7C',l:'CSS'},'.scss':{c:'#C6538C',l:'SC'},'.html':{c:'#E34F26',l:'HT'},'.json':{c:'#292929',l:'JN'},
  '.yaml':{c:'#6CB4EE',l:'YM'},'.md':{c:'#083FA1',l:'MD'},'.sql':{c:'#E38C00',l:'SQ'},'.graphql':{c:'#E10098',l:'GQ'}
};
const LT = new Set(['.js','.jsx','.go','.rs','.yaml','.scss']);

export class SVGGenerator {
  private template = 'ghost';
  private stats: ActivityStats = { totalSaves:0, totalLines:0, sessions:0, byLanguage:{}, lastSummary:'', projects:[], lastFile:'' };

  constructor(c: vscode.ExtensionContext) {
    this.template = vscode.workspace.getConfiguration('ghostcommit').get('template', 'ghost');
  }

  setTemplate(n: string) { this.template = n; }
  updateStats(s: ActivityStats) { this.stats = s; }

  async generate(): Promise<string> {
    if (this.template === 'wraith') return this.render('wraith');
    if (this.template === 'shadow') return this.render('shadow');
    return this.render('ghost');
  }

  private esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  private fmt(n: number) { return n>=1000?(n/1000).toFixed(1).replace('.0','')+'k':String(n); }

  private render(theme: string): string {
    const pal = theme==='wraith' ? {ico:'\uD83D\uDFE2',acc:'#2ea043'}
                : theme==='shadow' ? {ico:'\uD83D\uDD2D',acc:'#bc8cff'}
                : {ico:'\uD83D\uDC7B',acc:'#58a6ff'};
    const bg='#0d1117', fg='#c9d1d9', muted='#8b949e', dim='#21262d';

    const entries = Object.entries(this.stats.byLanguage).sort((a,b)=>b[1].lines-a[1].lines).slice(0,4);
    const max = Math.max(...entries.map(([,v])=>v.lines),1);
    const nRows = Math.max(Math.ceil(entries.length/2), 1);

    const projStr = this.stats.projects.length>0 ? this.stats.projects.join(' \u00B7 ') : 'nowhere';
    const barW = 120, rowH = 26;
    const rowStart = 70;
    const H = rowStart + nRows * rowH + 28;
    const bottomY = H - 12;

    const tz = -3; // GMT-3
    const d = new Date();
    const local = new Date(d.getTime() + tz * 60 * 60 * 1000);
    const ts = String(local.getUTCHours()).padStart(2,'0')+':'+String(local.getUTCMinutes()).padStart(2,'0')+' GMT'+tz;

    let rows = '';
    entries.forEach(([ext,data],i)=>{
      const col = i%2, row = Math.floor(i/2);
      const x = 25+col*265, y = rowStart+row*rowH;
      const p = Math.round((data.lines/max)*barW);
      const info = COL[ext] || {c:'#666',l:'?'};
      const txt = LT.has(ext)?'#1a1a2e':'#fff';
      rows += '<rect x="'+x+'" y="'+y+'" width="20" height="20" rx="4" fill="'+info.c+'"/>';
      rows += '<text x="'+(x+10)+'" y="'+(y+14)+'" fill="'+txt+'" font-family="'+MONO+'" font-size="9" font-weight="700" text-anchor="middle">'+info.l+'</text>';
      rows += '<text x="'+(x+26)+'" y="'+(y+14)+'" fill="'+fg+'" font-family="'+MONO+'" font-size="11">'+this.esc(ext)+'</text>';
      rows += '<rect x="'+(x+72)+'" y="'+(y+4)+'" width="'+barW+'" height="10" rx="3" fill="'+dim+'"/>';
      rows += '<rect x="'+(x+72)+'" y="'+(y+4)+'" width="'+Math.max(Math.min(p,barW),0)+'" height="10" rx="3" fill="'+info.c+'"/>';
      rows += '<text x="'+(x+72+barW+12)+'" y="'+(y+14)+'" fill="'+fg+'" font-family="'+MONO+'" font-size="11">'+this.fmt(data.lines)+'</text>';
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'
      +'<rect width="'+W+'" height="'+H+'" fill="'+bg+'" rx="10"/>'
      +'<rect x=".5" y=".5" width="'+(W-1)+'" height="'+(H-1)+'" fill="none" stroke="'+dim+'" rx="10"/>'
      +'<text x="25" y="28" fill="'+pal.acc+'" font-family="'+FONT+'" font-size="15" font-weight="700">'+pal.ico+' GhostCommit <tspan fill="'+muted+'" font-weight="400">- Today</tspan></text>'
      +'<text x="25" y="50" fill="'+fg+'" font-family="'+MONO+'" font-size="11">'+this.fmt(this.stats.totalSaves)+' commits</text>'
      +'<circle cx="108" cy="46" r="2" fill="'+muted+'"/>'
      +'<text x="118" y="50" fill="'+fg+'" font-family="'+MONO+'" font-size="11">'+this.stats.sessions+' echoes</text>'
      +'<circle cx="200" cy="46" r="2" fill="'+muted+'"/>'
      +'<text x="210" y="50" fill="'+fg+'" font-family="'+MONO+'" font-size="11">'+this.esc(projStr)+'</text>'
      +rows
      +'<text x="25" y="'+(bottomY)+'" fill="'+muted+'" font-family="'+MONO+'" font-size="11">\u21B3 '+this.esc(this.stats.lastFile||'idling...')+'</text>'
      +'<text x="'+(W-25)+'" y="'+(bottomY)+'" fill="'+muted+'" font-family="'+MONO+'" font-size="10" text-anchor="end">'+ts+'</text>'
      +'</svg>';
  }
}
