export class Logger {
  private static enabled: boolean;

  public static enable() {
    this.enabled = true;
  }

  public static disable() {
    this.enabled = false;
  }

  public static log(message?: any, ...optionalParams: any[]): void {
    if (typeof console === 'undefined') {
      return;
    }

    if (this.enabled) {
      console.log(this.printDate() + ' ' + message, ...optionalParams);
    }
  }

  public static error(message: string): void {
    if (typeof console === 'undefined') {
      return;
    }

    if (this.enabled) {
      console.error(message);
    }
  }

  public static warn(message: string): void {
    if (typeof console === 'undefined') {
      return;
    }

    if (this.enabled) {
      console.warn(message);
    }
  }

  private static printDate(): string {
    var temp = new Date();
    var dateStr = '[' +
      this.padString(temp.getHours()) + ':' +
      this.padString(temp.getMinutes()) + ':' +
      this.padString(temp.getSeconds()) + ']';
    return dateStr;
  }

  private static padString(i: number): string {
    return (i < 10) ? '0' + i : '' + i;
  }
}
