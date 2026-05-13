import * as vscode from 'vscode';
import { GitHubAuth } from './AuthProvider';
import { SVGGenerator, ActivityStats } from '../svg/Generator';
import { SessionCache } from '../tracker/SessionCache';

const VIBE_START = '<!-- VIBE_START -->';
const VIBE_END = '<!-- VIBE_END -->';

export class ProfileUpdater {
  constructor(
    private auth: GitHubAuth,
    private svgGen: SVGGenerator,
    private cache?: SessionCache
  ) {}

  private updateSvgStats() {
    if (!this.cache) return;
    const today = this.cache.getTodayStats();
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySessions = [...this.cache['sessions'] as any[], ...(this.cache['currentSession'] ? [this.cache['currentSession']] : [])]
      .filter((s: any) => s.date === todayStr).length;

    // Convert today's langs to ActivityStats format
    const byLanguage: Record<string, { saves: number; lines: number }> = {};
    for (const [ext, count] of Object.entries(today.langs)) {
      byLanguage[ext] = { saves: count, lines: count };
    }

    // Get today's last file
    let lastFile = '';
    const allData = [...(this.cache as any)['sessions'] as any[], ...((this.cache as any)['currentSession'] ? [(this.cache as any)['currentSession']] : [])];
    for (let i = allData.length - 1; i >= 0; i--) {
      const s = allData[i];
      if (s.date !== todayStr) continue;
      for (let j = s.entries.length - 1; j >= 0; j--) {
        if (!s.entries[j].hidden) { lastFile = s.entries[j].fileName; break; }
      }
      if (lastFile) break;
    }

    this.svgGen.updateStats({
      totalSaves: today.saves,
      totalLines: today.lines,
      sessions: todaySessions,
      byLanguage,
      lastSummary: 'Today',
      projects: today.projects,
      lastFile
    });
  }

  async setupReadme(): Promise<void> {
    const client = await this.auth.getClient();
    const username = this.auth.getUsername();
    const repo = username;

    let readmeContent: string;
    let sha: string | undefined;
    let exists = true;
    let hasTags = true;

    try {
      const { data } = await client.request('GET /repos/{owner}/{repo}/contents/README.md', {
        owner: username,
        repo
      });
      const d = data as { content: string; sha: string };
      readmeContent = Buffer.from(d.content, 'base64').toString('utf-8');
      sha = d.sha;
      exists = true;
      hasTags = readmeContent.includes(VIBE_START) && readmeContent.includes(VIBE_END);
    } catch {
      exists = false;
      hasTags = false;
      readmeContent = '';
    }

    if (!exists) {
      const choice = await vscode.window.showInformationMessage(
        'ghostcommit: You have no profile README yet. Create one with GhostCommit markers?',
        'Generate README Base',
        'Manual Instructions',
        'Not now'
      );
      if (choice === 'Generate README Base') {
        readmeContent = `# ${username}\n\n${VIBE_START}\n${VIBE_END}\n`;
        await this.pushUpdate(client, username, repo, readmeContent, undefined);
        vscode.window.showInformationMessage('ghostcommit: README created successfully!');
      } else if (choice === 'Manual Instructions') {
        vscode.window.showInformationMessage(
          'ghostcommit: Create a README.md in your profile repo and add:\n\n' +
          '<!-- VIBE_START -->\n<!-- VIBE_END -->\n\nWherever you want metrics to appear.'
        );
      }
      return;
    }

    if (!hasTags) {
      const choice = await vscode.window.showInformationMessage(
        'ghostcommit: Your README needs markers for auto-updates. How to proceed?',
        'Inject Markers (end of file)',
        'Manual Instructions',
        'Not now'
      );
      if (choice === 'Inject Markers (end of file)') {
        readmeContent += `\n\n${VIBE_START}\n${VIBE_END}\n`;
        await this.pushUpdate(client, username, repo, readmeContent, sha);
        vscode.window.showInformationMessage('ghostcommit: Markers added to your README!');
      } else if (choice === 'Manual Instructions') {
        vscode.window.showInformationMessage(
          'ghostcommit: Add these markers anywhere in your README.md:\n\n' +
          '<!-- VIBE_START -->\n<!-- VIBE_END -->\n\n' +
          'The extension will only modify content between them.'
        );
      }
      return;
    }

    vscode.window.showInformationMessage('ghostcommit: README already configured with markers!');
  }

  async update(): Promise<void> {
    const client = await this.auth.getClient();
    const username = this.auth.getUsername();
    const repo = username;

    let readmeContent: string;
    let sha: string | undefined;

    try {
      const { data } = await client.request('GET /repos/{owner}/{repo}/contents/README.md', {
        owner: username,
        repo
      });
      const d = data as { content: string; sha: string };
      readmeContent = Buffer.from(d.content, 'base64').toString('utf-8');
      sha = d.sha;

      if (!readmeContent.includes(VIBE_START) || !readmeContent.includes(VIBE_END)) {
        return;
      }
    } catch {
      return;
    }

    this.updateSvgStats();
    const svgRaw = await this.svgGen.generate();
    const svgFilename = 'ghostcommit-metrics.svg';

    // Push SVG as a file to the profile repo
    let svgSha: string | undefined;
    try {
      const { data: existing } = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: username, repo, path: svgFilename
      });
      svgSha = (existing as { sha: string }).sha;
    } catch {}

    await client.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: username, repo, path: svgFilename,
      message: '[GhostCommit] Update metrics SVG',
      content: Buffer.from(svgRaw).toString('base64'),
      sha: svgSha
    });

    const svgImg = `<img src="https://raw.githubusercontent.com/${username}/${username}/main/${svgFilename}?t=${Date.now()}" alt="GhostCommit Metrics"/>`;
    const metricsSection = this.buildMetricsSection();

    const beforeStart = readmeContent.split(VIBE_START)[0];
    const afterEnd = readmeContent.includes(VIBE_END)
      ? readmeContent.split(VIBE_END).slice(1).join(VIBE_END)
      : '';

    const newReadme = `${beforeStart}${VIBE_START}\n\n${metricsSection}\n\n${svgImg}\n\n${VIBE_END}${afterEnd}`;

    const autoPush = vscode.workspace.getConfiguration('ghostcommit').get<boolean>('autoPush', true);
    if (autoPush) {
      await this.pushUpdate(client, username, repo, newReadme, sha);
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      'ghostcommit wants to update your profile README',
      { modal: false },
      'Preview',
      'Push Now',
      'Skip'
    );

    if (choice === 'Preview') {
      await vscode.workspace.openTextDocument({ content: newReadme, language: 'markdown' })
        .then(doc => vscode.window.showTextDocument(doc));
      const confirm = await vscode.window.showInformationMessage(
        'Push these changes to GitHub?',
        { modal: false },
        'Push Now',
        'Skip'
      );
      if (confirm !== 'Push Now') {
        vscode.window.showInformationMessage('ghostcommit: Update skipped.');
        return;
      }
    } else if (choice === 'Skip') {
      vscode.window.showInformationMessage('ghostcommit: Update skipped.');
      return;
    }

    await this.pushUpdate(client, username, repo, newReadme, sha);
  }

  private async pushUpdate(
    client: import('octokit').Octokit,
    owner: string,
    repo: string,
    content: string,
    sha: string | undefined
  ) {
    try {
      await client.request('PUT /repos/{owner}/{repo}/contents/README.md', {
        owner,
        repo,
        path: 'README.md',
        message: '[GhostCommit Auto-Update] Profile metrics refresh',
        content: Buffer.from(content).toString('base64'),
        sha
      });
    } catch (err: any) {
      const msg = `GitHub push failed: ${err?.message || err}`;
      vscode.window.showErrorMessage(`ghostcommit: ${msg}`);
      throw err;
    }
  }

  private buildMetricsSection(): string {
    return `<!-- Last updated: ${new Date().toISOString()} -->`;
  }
}
