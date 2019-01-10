interface YSSessionManagerDelegateFunction {
  (state: YSSessionResult, result: YSSessionStatus): void;
}

declare enum YSSessionResult {
  INITIALISED,
  NO_ANALYTICS,
  NOT_INITIALISED,
}

declare enum YSSessionStatus {
  CONNECTION_ERROR,
  CONNECTION_TIMEOUT,
  MALFORMED_URL,
  NON_YOSPACE_URL,
  NO_LIVEPAUSE,
}

interface YSSessionManagerDefault {
  LOW_FREQ: number;   // Low-Priority Poll Interval (mSecs)
  HIGH_FREQ: number;  // High-Priority Poll Interval (mSecs)
  USE_ID3: boolean;   // Use ID3 tags instead of playback position
                      // (Note that this should never be user-modified)
  AD_DEBUG: boolean;  // Should Ad debugging be found and printed (from yo.ad)
  DEBUGGING: boolean; // Should trace messages be output to the console?
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
  reportPlayerEvent(evt: YSPlayerEvents, data?: any): void;
  shutdown(): void;
}

declare enum YSPlayerEvents {
  CLICK,
  CONTINUE,
  END,
  ERROR,
  FULLSCREEN,
  LINEAR_EVENT,
  METADATA,
  MUTE,
  NONLINEAR,
  NONLINEAR_EVENT,
  PAUSE,
  POSITION,
  READY,
  RESUME,
  SEEK_END,
  SEEK_START,
  STALL,
  START,
}

declare class VASTLinear {
  skipOffset: number;
  clickThrough: string;
  mediaFiles: any[];
}

declare class VASTAd {
  /**
   * The linear creative contained within this Ad, or null where the ad does not contain a linear creative.
   */
  linear: VASTLinear;
  id: string;
  vastXML: Element;
  Extensions: XMLDocument[];
}

declare class YSAdvert {
  advert: VASTAd;
  duration: number;
  adBreak: YSAdBreak;
  isActive: boolean;

  adPaused(): void;
  adResumed(): void;
  setActive(active: boolean): void;
  hasInteractiveUnit(): boolean;
  getInteractiveUnit(): VASTInteractive;
}

declare class YSAdBreak {
  adBreakDescription?: string;
  adBreakIdentifier: string;
  adBreakStart: number;
  adverts: YSAdvert[];
  startPosition: number;

  getDuration(): number;
}

declare class YSSession {
  currentAdvert: YSAdvert;
  timeline: YSTimeline;

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

declare class YSTimelineElement {
  static ADVERT: string;
  static VOD: string;
  static LIVE: string;

  offset: number;
  duration: number;
  type: string;
  adBreak: YSAdBreak;

  getType(): string;
  getAdverts(): YSAdBreak;
}

declare class YSTimeline {
  getAllElements(): YSTimelineElement[];
}

// VPAID Stuff
declare class VASTInteractive {
  /**
   * @param ev The event type to report
   * @param position The number of seconds into ad playback where the event occured
   * @param asset The video asset URL being played
   * @param brktime The total time of the break containing the advert
   */
  track(ev: string, position: number, asset: string, brktime: string): void;
}


