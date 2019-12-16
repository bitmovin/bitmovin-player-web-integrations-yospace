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
      console.log(message, ...optionalParams);
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
}
