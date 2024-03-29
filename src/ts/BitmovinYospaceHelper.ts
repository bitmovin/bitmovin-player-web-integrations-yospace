export class BitmovinYospaceHelper {
  public static isSafari(): boolean {
    return (
      navigator.userAgent.includes('Safari') &&
      !navigator.userAgent.includes('Chrome') &&
      !navigator.userAgent.includes('IEMobile') &&
      !navigator.userAgent.includes('Edge')
    );
  }

  public static isSafariIOS(): boolean {
    return /Safari/i.test(navigator.userAgent) && /iP(hone|od|ad)/i.test(navigator.userAgent);
  }
}

export enum EmsgSchemeIdUri {
  V0_ID3_YOSPACE_PROPRIETARY = 'urn:yospace:a:id3:2016',
  V1_ID3 = 'https://aomedia.org/emsg/ID3',
}
