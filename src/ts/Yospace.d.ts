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
  session: YSSession;

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

declare class VASTLinear {

}

declare class VASTAd {
  /**
   * The linear creative contained within this Ad, or null where the ad does not contain a linear creative.
   */
  linear: VASTLinear;
  duration: number;
  skipOffset: number;
}

declare class YSAdvert {
  advert: VASTAd;

  adPaused(): void;
  adResumed(): void;
}

declare class YSAdBreak {
  adBreakDescription?: string;
  adBreakIdentifier: string;
  adBreakStart: number;
  adverts: YSAdvert[];
  startPosition: number;
}

declare class YSSession {
  currentAdvert: YSAdvert;

  getLinearClickthrough(): string;
}

declare class YSPlayerPolicy {
  constructor(_session: YSSession);
  /**
   * New fullscreen state requested (true to enter fullscreen, false to leave fullscreen)
   * @param newState
   */
  canChangeFullScreen(newState: boolean): boolean;
  canClickThrough(): boolean;
  canExpandCreative(): boolean;
  canMute(): boolean;
  canPause(): boolean;

  /**
   * Determine whether the player is allowed to seek from the current playhead position
   */
  canSeek(): boolean;

  /**
   * Determine whether the player is permitted to seek to a permitted point in the stream.
   * Based on the provided location, the nearest permissible location is returned which should be
   * used by the player to override the viewers chosen seek location.
   * This is to enable the ability to prevent skipping over adverts.
   * @param offset
   */
  canSeekTo(offset: number): number;

  /**
   * @return 0+ if skip is permitted
   * the value is the delay in seconds before skip is permitted, otherwise -1 which means the advert is not skippable
   */
  canSkip(): number;
  canStart(): boolean;
}
