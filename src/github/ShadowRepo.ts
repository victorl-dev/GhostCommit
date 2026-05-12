import * as vscode from 'vscode';
import { GitHubAuth } from './AuthProvider';

export class ShadowRepo {
  private lastCommitInfo: string = '';

  constructor(private auth: GitHubAuth) {}

  async ensureRepo(): Promise<string> {
    const client = await this.auth.getClient();
    const username = this.auth.getUsername();
    const repoName = vscode.workspace.getConfiguration('ghostcommit').get('shadowRepoName', 'ghostcommit-logs');

    try {
      await client.request('GET /repos/{owner}/{repo}', {
        owner: username,
        repo: repoName
      });
      return repoName;
    } catch {
      const { data: repo } = await client.request('POST /user/repos', {
        name: repoName,
        private: true,
        description: 'Auto-generated activity logs from GhostCommit',
        auto_init: true
      });
      return repo.name;
    }
  }

  async commitActivity(summary: string, filesCount: number): Promise<void> {
    const client = await this.auth.getClient();
    const username = this.auth.getUsername();
    const repoName = vscode.workspace.getConfiguration('ghostcommit').get('shadowRepoName', 'ghostcommit-logs');

    const today = new Date().toISOString().split('T')[0];
    const path = `logs/${today}.json`;

    let sha: string | undefined;
    try {
      const { data } = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: username,
        repo: repoName,
        path
      });
      sha = (data as { sha: string }).sha;
    } catch {
      sha = undefined;
    }

    const content = {
      date: today,
      summary,
      filesChanged: filesCount,
      timestamp: new Date().toISOString()
    };

    await client.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: username,
      repo: repoName,
      path,
      message: `[GhostCommit] ${summary}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      sha
    });

    this.lastCommitInfo = `${today}: ${summary}`;
  }

  getLastCommitInfo(): string {
    return this.lastCommitInfo;
  }
}
