import * as vscode from 'vscode';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private tracking = false;
  private changeCount = 0;
  private startTime = Date.now();

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'vibetracker.dashboard';
  }

  show() {
    this.item.show();
  }

  setTracking(active: boolean) {
    this.tracking = active;
    if (active) this.startTime = Date.now();
    this.updateDisplay();
  }

  isTracking() {
    return this.tracking;
  }

  setChangeCount(n: number) {
    this.changeCount = n;
    this.updateDisplay();
  }

  private elapsed(): string {
    const min = Math.floor((Date.now() - this.startTime) / 60000);
    if (min < 60) return `${min}m`;
    return `${Math.floor(min/60)}h ${min%60}m`;
  }

  private updateDisplay() {
    if (this.tracking) {
      this.item.text = `$(graph) VibeTracker: ${this.changeCount} changes`;
      this.item.tooltip = `VibeTracker — tracking ${this.elapsed()}\n${this.changeCount} file change(s) this session\nClick to open Dashboard`;
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(circle-slash) VibeTracker: paused';
      this.item.tooltip = 'Tracking paused\nClick VibeTracker: Start or open Dashboard';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  dispose() {
    this.item.dispose();
  }
}
