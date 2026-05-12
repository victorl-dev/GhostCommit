import * as vscode from 'vscode';
import { Octokit } from 'octokit';

export class GitHubAuth {
  private octokit: Octokit | null = null;
  private username: string = '';

  async login(): Promise<Octokit> {
    const session = await vscode.authentication.getSession('github', ['repo'], {
      createIfNone: true
    });

    this.octokit = new Octokit({ auth: session.accessToken });

    const { data: user } = await this.octokit.request('GET /user');
    this.username = user.login;

    return this.octokit;
  }

  async getClient(): Promise<Octokit> {
    if (this.octokit) return this.octokit;

    try {
      const session = await vscode.authentication.getSession('github', ['repo'], {
        createIfNone: false
      });
      if (session) {
        this.octokit = new Octokit({ auth: session.accessToken });
        const { data: user } = await this.octokit.request('GET /user');
        this.username = user.login;
      }
    } catch {
      throw new Error('Not authenticated with GitHub. Run VibeTracker: Login first.');
    }

    if (!this.octokit) {
      throw new Error('Not authenticated with GitHub. Run VibeTracker: Login first.');
    }

    return this.octokit;
  }

  getUsername(): string {
    return this.username;
  }

  isAuthenticated(): boolean {
    return this.octokit !== null;
  }
}
