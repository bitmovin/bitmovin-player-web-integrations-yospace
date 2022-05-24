declare interface YSAdBreak {
  getAdverts: any;
  getDuration: any;
  getExtensions: any;
  getIdentifier: any;
  getPosition: any;
  getRemainingTime: any;
  getStart: any;
  getType: any;
  isActive: any;
  setAdvertsInactivePriorTo: any;
  setInactive: any;
  onNonLinearTrackingEvent: any;
  // ...
}

declare interface YSAdvert {
  addMacroSubstitution: any;
  getAdType: any;
  getAdVerifications: any;
  getCompanionAdsByType: any;
  getCompanionRequired: any;
  getDuration: any;
  getErrors: any;
  getExtensions: any;
  getIdentifier: any;
  getIndustryIcons: any;
  getInteractiveCreative: any;
  getLineage: any;
  getLinearCreative: any;
  getMacroSubstitutions: any;
  getNonLinearCreativesByType: any;
  getProperties: any;
  getProperty: any;
  getRemainingTime: any;
  getSequence: any;
  getSkipOffset: any;
  getStart: any;
  isActive: any;
  isFiller: any;
  isNonLinear: any;
  removeMacroSubstitution: any;
  // ...
}

declare interface YSSession {
  // PlaybackEventHandler methods
  onTimedMetadata: any;
  onPlayerEvent: any;
  onPlayheadUpdate: any;
  onViewSizeChange: any;
  onVolumeChange: any;

  // SessionVOD
  getContentPositionForPlayhead: (num: number) => number;
  getPlayheadForContentPosition: (num: number) => number;

  // Session methods
  addAnalyticObserver: any;
  analyticsSuppressed: any;
  canChangeVolume: any;
  canClickThrough: any;
  canPause: any;
  canResize: any;
  canResizeCreative: any;
  canSkip: any;
  canStop: any;
  getAdBreaksByType: (type: BreakType['LINEAR'] | BreakType['NONLINEAR'] | BreakType['DISPLAY']) => YSAdBreak[];
  getCurrentAdBreak: any;
  getCurrentAdvert: any;
  getIdentifier: any;
  getPlaybackMode: any;
  getPlaybackUrl: any;
  getResultCode: () => number;
  getSessionResult: any;
  removeAllNonLinearAdBreaks: any;
  removeAnalyticObserver: any;
  removeNonLinearAdBreak: any;
  setPlaybackPolicyHandler: any;
  shutdown: any;
  willSeekTo: any;
  suppressAnalytics: (bool: boolean) => void;
  // ...
}

declare interface SessionVOD {
  create: any;
  // ...
}

declare interface SessionLive {
  create: any;
  // ...
}

declare interface SessionNLSO {
  create: any;
  // ...
}

declare const YospaceAdManagement: YospaceAdManagement;

interface AnalyticEventObserver {
  // ...
}

type BreakType = {
  LINEAR: 0;
  NONLINEAR: 1;
  DISPLAY: 2;
};

declare interface YospaceAdManagement {
  CAT_AD_BREAK_EVENTS: 1;
  CAT_TIMELINE_EVENTS: 2;
  CONNECTION_ERROR: -1;
  CONNECTION_TIMEOUT: -2;
  DEBUG_ALL: number;
  DEBUG_HTTP_REQUESTS: 32;
  DEBUG_LIFECYCLE: 2;
  DEBUG_PARSING: 64;
  DEBUG_PLAYBACK: 1;
  DEBUG_POLLING: 4;
  DEBUG_REPORTS: 8;
  DEBUG_STATE_MACHINE: 16;
  DEBUG_VALIDATION: 128;
  MALFORMED_URL: -3;
  UNKNOWN_FORMAT: -20;

  BreakType: BreakType;

  AdBreak: any;
  AdVerification: any;
  Advert: any;
  AdvertEventHandler: any;
  AdvertWrapper: any;
  AnalyticBroker: any;
  AnalyticEventObserver: AnalyticEventObserver;
  CompanionAds: any;
  Creative: any;
  CreativeEventHandler: any;
  IconClickFallbackImage: any;
  IndustryIcon: any;
  InteractiveCreative: any;
  LinearCreative: any;
  NonLinearCreative: any;
  PlaybackEventHandler: any;
  PlaybackMode: any;
  PlaybackPolicy: any;
  PlaybackPolicyHandler: any;
  PlayerEvent: { START: 0, STOP: 1, PAUSE: 2, RESUME: 3, STALL: 4, CONTINUE: 5, ADVERT_REWIND: 6, ADVERT_SKIP: 7, SEEK: 8 };
  Resource: any;
  ResourceType: any;
  Session: any;
  SessionDVRLive: any;
  SessionLive: SessionLive;
  SessionNLSO: SessionNLSO;
  SessionProperties: any;
  SessionResult: {
    NOT_INITIALISED: number;
    INITIALISED: number;
    FAILED: number;
    NO_ANALYTICS: number;
  };
  SessionVOD: SessionVOD;
  TimedMetadata: any;
  VASTProperty: any;
  VerificationEventHandler: any;
  ViewSize: any;
  ViewableEvent: any;
  YoLog: any;
  // ...
}
