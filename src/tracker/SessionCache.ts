import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface SessionEntry {
  timestamp: string;
  fileExt: string;
  linesAdded: number;
  linesRemoved: number;
  projectName: string;
  fileName: string;
  hidden?: boolean;
}

export interface SessionData {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  entries: SessionEntry[];
  summary: string;
  committed: boolean;
}

export class SessionCache {
  private sessions: SessionData[] = [];
  private currentSession: SessionData | null = null;
  private storagePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.storagePath = context.globalStorageUri.fsPath;
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    this.load();
  }

  private get cacheFile(): string {
    return path.join(this.storagePath, 'vibetracker-sessions.json');
  }

  private load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf-8');
        const data = JSON.parse(raw);
        this.sessions = data.sessions || [];
        this.currentSession = data.currentSession || null;
      }
    } catch {
      this.sessions = [];
      this.currentSession = null;
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify({
        sessions: this.sessions,
        currentSession: this.currentSession
      }, null, 2), 'utf-8');
    } catch (err) {
      console.error('VibeTracker: Failed to save cache', err);
    }
  }

  startNewSession() {
    const now = new Date();
    this.currentSession = {
      sessionId: `session_${now.getTime()}`,
      date: now.toISOString().split('T')[0],
      startTime: now.toISOString(),
      endTime: now.toISOString(),
      entries: [],
      summary: '',
      committed: false
    };
    this.save();
  }

  addEntry(entry: SessionEntry) {
    if (!this.currentSession) {
      this.startNewSession();
    }
    this.currentSession!.entries.push(entry);
    this.currentSession!.endTime = new Date().toISOString();
    this.save();
  }

  commitSession(summary: string) {
    if (this.currentSession) {
      this.currentSession.summary = summary;
      this.currentSession.committed = true;
      this.currentSession.endTime = new Date().toISOString();
      this.sessions.push(this.currentSession);
      this.currentSession = null;
      this.save();
    }
  }

  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  getSessionCount(): number {
    return this.sessions.length + (this.currentSession ? 1 : 0);
  }

  getRecentSessions(count: number = 10): SessionData[] {
    return [...this.sessions].reverse().slice(0, count);
  }

  getAllCommitted(): SessionData[] {
    return this.sessions.filter(s => s.committed);
  }

  getActivityByLanguage(): Record<string, { saves: number; lines: number }> {
    const result: Record<string, { saves: number; lines: number }> = {};
    for (const session of [...this.sessions, ...(this.currentSession ? [this.currentSession] : [])]) {
      for (const entry of session.entries) {
        if (!result[entry.fileExt]) {
          result[entry.fileExt] = { saves: 0, lines: 0 };
        }
        result[entry.fileExt].saves++;
        result[entry.fileExt].lines += entry.linesAdded;
      }
    }
    return result;
  }

  getTotalStats() {
    let totalSaves = 0;
    let totalLines = 0;
    for (const session of [...this.sessions, ...(this.currentSession ? [this.currentSession] : [])]) {
      for (const entry of session.entries) {
        totalSaves++;
        totalLines += entry.linesAdded;
      }
    }
    return { totalSaves, totalLines };
  }

  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    let saves = 0;
    let lines = 0;
    const langs: Record<string, number> = {};
    const projects = new Set<string>();
    const hiddenProjects: string[] = [];

    for (const session of [...this.sessions, ...(this.currentSession ? [this.currentSession] : [])]) {
      if (session.date !== today) continue;
      for (const entry of session.entries) {
        saves++;
        lines += entry.linesAdded;
        const ext = entry.fileExt || '?';
        langs[ext] = (langs[ext] || 0) + 1;
        if (entry.hidden) {
          if (!hiddenProjects.includes(entry.projectName)) hiddenProjects.push(entry.projectName);
        } else {
          projects.add(entry.projectName);
        }
      }
    }
    return { saves, lines, langs, projects: [...projects], hiddenProjects };
  }
}
