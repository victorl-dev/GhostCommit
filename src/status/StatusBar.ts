import * as vscode from 'vscode';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private tracking = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'vibetracker.dashboard';
  }

  show() {
    this.item.show();
  }

  setTracking(active: boolean) {
    this.tracking = active;
    this.updateText();
  }

  isTracking() {
    return this.tracking;
  }

  updateText(sessionInfo?: string) {
    if (this.tracking) {
      const info = sessionInfo ? ` - ${sessionInfo}` : '';
      this.item.text = `$(graph) VibeTracker: tracking${info}`;
      this.item.tooltip = 'Click to open VibeTracker Dashboard';
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(circle-slash) VibeTracker: paused';
      this.item.tooltip = 'Click to open VibeTracker Dashboard';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  dispose() {
    this.item.dispose();
  }
}
