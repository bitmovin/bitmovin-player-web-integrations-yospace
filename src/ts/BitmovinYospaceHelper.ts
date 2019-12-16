export class BitmovinYospaceHelper {
  public static isSafari(): boolean {
    return navigator.userAgent.includes('Safari') &&
      !navigator.userAgent.includes('Chrome') &&
      !navigator.userAgent.includes('IEMobile') &&
      !navigator.userAgent.includes('Edge');
  }

  public static isSafariIOS(): boolean {
    return /Safari/i.test(navigator.userAgent) && /iP(hone|od|ad)/i.test(navigator.userAgent);
  }
}