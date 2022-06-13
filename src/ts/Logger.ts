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

  public static table(message: any): void {
    if (typeof console === 'undefined') {
      return;
    }

    if (this.enabled) {
      // Check for IE 11 which doesn't support console.table()
      if (window.navigator.userAgent.indexOf('Trident/') > 0) {
        console.log(message);
      } else {
        console.table(message);
      }
    }
  }

  private static printDate(): string {
    const temp = new Date();
    const dateStr = '[' +
      this.padString(temp.getHours()) + ':' +
      this.padString(temp.getMinutes()) + ':' +
      this.padString(temp.getSeconds()) + ']';
    return dateStr;
  }

  private static padString(i: number): string {
    return (i < 10) ? '0' + i : '' + i;
  }
}
