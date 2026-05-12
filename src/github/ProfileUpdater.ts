import * as vscode from 'vscode';
import { GitHubAuth } from './AuthProvider';
import { SVGGenerator } from '../svg/Generator';

const VIBE_START = '<!-- VIBE_START -->';
const VIBE_END = '<!-- VIBE_END -->';

export class ProfileUpdater {
  constructor(
    private auth: GitHubAuth,
    private svgGen: SVGGenerator
  ) {}

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
        'VibeTracker: You have no profile README yet. Create one with VibeTracker markers?',
        'Generate README Base',
        'Manual Instructions',
        'Not now'
      );
      if (choice === 'Generate README Base') {
        readmeContent = `# ${username}\n\n${VIBE_START}\n${VIBE_END}\n`;
        await this.pushUpdate(client, username, repo, readmeContent, undefined);
        vscode.window.showInformationMessage('VibeTracker: README created successfully!');
      } else if (choice === 'Manual Instructions') {
        vscode.window.showInformationMessage(
          'VibeTracker: Create a README.md in your profile repo and add:\n\n' +
          '<!-- VIBE_START -->\n<!-- VIBE_END -->\n\nWherever you want metrics to appear.'
        );
      }
      return;
    }

    if (!hasTags) {
      const choice = await vscode.window.showInformationMessage(
        'VibeTracker: Your README needs markers for auto-updates. How to proceed?',
        'Inject Markers (end of file)',
        'Manual Instructions',
        'Not now'
      );
      if (choice === 'Inject Markers (end of file)') {
        readmeContent += `\n\n${VIBE_START}\n${VIBE_END}\n`;
        await this.pushUpdate(client, username, repo, readmeContent, sha);
        vscode.window.showInformationMessage('VibeTracker: Markers added to your README!');
      } else if (choice === 'Manual Instructions') {
        vscode.window.showInformationMessage(
          'VibeTracker: Add these markers anywhere in your README.md:\n\n' +
          '<!-- VIBE_START -->\n<!-- VIBE_END -->\n\n' +
          'The extension will only modify content between them.'
        );
      }
      return;
    }

    vscode.window.showInformationMessage('VibeTracker: README already configured with markers!');
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

    const svgContent = await this.svgGen.generate();
    const metricsSection = this.buildMetricsSection();

    const beforeStart = readmeContent.split(VIBE_START)[0];
    const afterEnd = readmeContent.includes(VIBE_END)
      ? readmeContent.split(VIBE_END).slice(1).join(VIBE_END)
      : '';

    const newReadme = `${beforeStart}${VIBE_START}\n\n${metricsSection}\n\n${svgContent}\n\n${VIBE_END}${afterEnd}`;

    const notification = await vscode.window.showInformationMessage(
      'VibeTracker wants to update your profile README',
      'Preview',
      'Dismiss'
    );

    if (notification === 'Preview') {
      const doc = await vscode.workspace.openTextDocument({
        content: newReadme,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
      const confirm = await vscode.window.showInformationMessage(
        'Preview the changes. Push to GitHub?',
        'Push',
        'Cancel'
      );
      if (confirm !== 'Push') return;
    } else if (notification === 'Dismiss') {
      setTimeout(() => {
        this.pushUpdate(client, username, repo, newReadme, sha);
      }, 10000);
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
    await client.request('PUT /repos/{owner}/{repo}/contents/README.md', {
      owner,
      repo,
      path: 'README.md',
      message: '[VibeTracker Auto-Update] Profile metrics refresh',
      content: Buffer.from(content).toString('base64'),
      sha
    });
  }

  private buildMetricsSection(): string {
    return `<!-- Last updated: ${new Date().toISOString()} -->`;
  }
}
