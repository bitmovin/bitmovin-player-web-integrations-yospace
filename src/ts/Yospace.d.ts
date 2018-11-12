interface YSSessionManagerDelegateFunction {
  (state: YSSessionResult, result: YSSessionStatus): void;
}

declare enum YSSessionResult {
  INITIALISED,
  NO_ANALYTICS,
  NOT_INITIALISED
}

declare enum YSSessionStatus {
  CONNECTION_ERROR,
  MALFORMED_URL,
  NON_YOSPACE_URL,
  CONNECTION_TIMEOUT,
  NO_LIVEPAUSE,
}

interface YSSessionManagerDefault {
  LOW_FREQ: number,  // Low-Priority Poll Interval (mSecs)
  HIGH_FREQ: number, // High-Priority Poll Interval (mSecs)
  USE_ID3: boolean,  // Use ID3 tags instead of playback position
                     // (Note that this should never be user-modified)
  AD_DEBUG: boolean, // Should Ad debugging be found and printed (from yo.ad)
  DEBUGGING: boolean // Should trace messages be output to the console?
}

declare class YSSessionManager {
  static DEFAULTS: YSSessionManagerDefault;

  listener: any;
  player: Object;
  poller: any;

  static createForLive(url: string, properties: Object, delegate: YSSessionManagerDelegateFunction): YSSessionManager;
  static createForLivePause(url: string, properties: Object, delegate: YSSessionManagerDelegateFunction): YSSessionManager;
  static createForNonLinear(url: string, properties: Object, delegate: YSSessionManagerDelegateFunction): YSSessionManager;
  static createForVoD(url: string, properties: Object, delegate: YSSessionManagerDelegateFunction): YSSessionManager;

  masterPlaylist(): string;
  registerPlayer(cb_obj: Object): void;
  isYospaceStream(): boolean;
  reportPlayerEvent(evt: string, data?: any): void;
  shutdown(): void;
}

declare enum YSPlayerEvents {
  CLICK = "click",
  CONTINUE = "continue",
  END = "complete",
  ERROR = "error",
  FULLSCREEN = "fullscreen",
  LINEAR_EVENT = "linear",
  METADATA = "id3",
  MUTE = "mute",
  NONLINEAR = "non_linear",
  NONLINEAR_EVENT = "nonlinear",
  PAUSE = "pause",
  POSITION = "position",
  READY = "ready",
  RESUME = "resume",
  SEEK_END = "seek_end",
  SEEK_START = "seek_begin",
  STALL = "buffer",
  START = "start"
}

declare class YSAdvert {
  
}

declare class YSAdBreak {
  adBreakDescription?: string;
  adBreakIdentifier: string;
  adBreakStart: number;
  adverts: YSAdvert[];
  startPosition: number;
}

declare class YSTimeline {

}
