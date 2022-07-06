import { YospaceErrorCode } from './BitmovinYospacePlayerAPI';

export class YospacePlayerError implements Error {
  public readonly code: YospaceErrorCode;
  public readonly message: string;
  public readonly name: string;
  public readonly stack: string;
  public readonly data: { [key: string]: any };

  constructor(code: YospaceErrorCode, data?: { [key: string]: any }, message?: string) {
    this.code = code;
    this.name = YospaceErrorCode[code];

    if (message) {
      this.message = message;
    } else {
      this.message = `${this.code}/${this.name}`; // Message is necessary for compatibility with Error base class
    }

    this.data = data;
    this.stack = new Error(this.message).stack;
  }
}
