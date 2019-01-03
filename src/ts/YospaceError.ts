import { PlayerEventBase } from 'bitmovin-player';

export enum YospacePlayerEvent {
  YospaceError = 'yospaceerror',
  PolicyError = 'policyerror',
}

export enum YospaceErrorCode {
  UNKNOWN_ERROR = 1000,
  INVALID_SOURCE = 1001,
  NO_ANALYTICS = 1002,
  NOT_INITIALISED = 1003,
  INVALID_PLAYER = 1004,
}

export enum YospacePolicyErrorCode {
  MUTE_NOT_ALLOWED = 1000,
  SEEK_NOT_ALLOWED = 1001,
  SEEK_TO_NOT_ALLOWED = 1002,
  SKIP_NOT_ALLOWED = 1003,
  PAUSE_NOT_ALLOWED = 1004,
  CHANGE_PLAYBACK_SPEED_NOT_ALLOWED = 1005,
}

export interface YospaceErrorEvent extends YospaceEventBase {
  code: YospaceErrorCode;
  name: string;
}

export interface YospacePolicyError extends YospaceEventBase {
  code: YospacePolicyErrorCode;
}

export interface YospaceEventBase {
  type: YospacePlayerEvent;
}

export interface YospacePlayerEventCallback {
  (event: PlayerEventBase | YospaceEventBase): void;
}

export class YospacePlayerError implements Error {
  public readonly code: YospaceErrorCode;
  public readonly message: string;
  public readonly name: string;
  public readonly stack: string;
  public readonly data: { [key: string]: any; };

  constructor(code: YospaceErrorCode, data?: { [key: string]: any; }, message?: string) {
    this.code = code;
    this.name = YospaceErrorCode[code];

    if (message) {
      this.message = message;
    } else {
      this.message = `${this.code}/${this.name}`; // Message is necessary for compatibility with Error base class
    }

    this.data = data;
    this.stack = (new Error(this.message)).stack;
  }
}
