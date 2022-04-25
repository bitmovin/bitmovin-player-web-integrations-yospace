import {
  AdBreak, CompanionAd, PlayerAPI, PlayerEvent, PlayerEventBase, PlayerEventCallback, PlayerExports, SourceConfig,
} from 'bitmovin-player';

// Enums

export enum YospaceAssetType {
  LINEAR,
  VOD,
  LINEAR_START_OVER,
}

export enum YospacePlayerType {
  Bitmovin,
  BitmovinYospace,
}

export enum YospaceAdBreakPosition {
  Unknown = 'unknown',
  PreRoll = 'preroll',
  MidRoll = 'midroll',
  PostRoll = 'postroll',
}

// Constants

// The ads API of the player does not export the VastErrorCodes. As they are standardised we can hard code the undefined
// error code here.
export const UNDEFINED_VAST_ERROR_CODE = 900;

// Public API

export interface BitmovinYospacePlayerAPI extends PlayerAPI {
  readonly exports: BitmovinYospacePlayerExports;

  setup(): Promise<void>;

  load(source: SourceConfig | YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void>;

  on(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;

  off(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;

  setPolicy(policy: BitmovinYospacePlayerPolicy): void;

  getCurrentPlayerType(): YospacePlayerType;

  forceSeek(time: number, issuer?: string): boolean;
}

export interface YospaceSourceConfig extends SourceConfig {
  assetType: YospaceAssetType;
  truexConfiguration?: TruexConfiguration;
}

export interface TruexConfiguration {
  userId: string;
  vastConfigUrl: string;
}

export interface YospaceAdBreak extends AdBreak {
  duration: number;
  position?: YospaceAdBreakPosition;
}

export interface YospaceAdBreakEvent extends PlayerEventBase {
  adBreak: YospaceAdBreak;
}

export interface YospaceCompanionAd extends CompanionAd {
  id: string;
  resource: CompanionAdResource;
  creativeTrackingEvents?: string [];
  companionClickThroughURLTemplate?: string;
  companionClickTrackingURLTemplates?: string [];
  adSlotId: string | null;
}

export interface CompanionAdResource {
  url: string;
  type: CompanionAdType;
}

export enum CompanionAdType {
  StaticResource = 'staticresource',
  HtmlResource = 'htmlresource',
  IFrameResource = 'iframeresource',
  UnknownResource = 'unknownresource',
}

export interface YospaceConfiguration {
  debug?: boolean;
  disableServiceWorker?: boolean;
  disableStrictBreaks?: boolean;
  breakTolerance?: number;
  useTizen?: boolean;
  useWebos?: boolean;
}

export interface BitmovinYospacePlayerExports extends PlayerExports {
  readonly YospacePlayerEvent: typeof YospacePlayerEvent;
  readonly YospaceAssetType: typeof YospaceAssetType;
  readonly YospaceErrorCode: typeof YospaceErrorCode;
  readonly YospacePolicyErrorCode: typeof YospacePolicyErrorCode;
  readonly YospacePlayerType: typeof YospacePlayerType;
}

// Policy

export interface BitmovinYospacePlayerPolicy {
  canMute(): boolean;

  canSeek(): boolean;

  /**
   * Determine whether the player is permitted to seek to a point in the stream.
   * Based on the provided location, the nearest permissible location is returned which should be
   * used by the player to override the viewers chosen seek location.
   * This provides the ability to prevent skipping over adverts.
   * @param seekTarget
   * @return The closest available seek target. Default start time of last ad which would be skipped.
   */
  canSeekTo(seekTarget: number): number;

  /**
   * @return 0+ if skip is permitted
   * the value is the delay in seconds before skip is permitted, otherwise -1 which means the advert is not skippable
   */
  canSkip(): number;

  canPause(): boolean;

  canChangePlaybackSpeed(): boolean;
}

// Error handling

export enum YospacePlayerEvent {
  YospaceError = 'yospaceerror',
  PolicyError = 'policyerror',
  TruexAdFree = 'truexadfree',
  TruexAdBreakFinished = 'truexadbreakfinished',
}

export enum YospaceErrorCode {
  UNKNOWN_ERROR = 1000,
  INVALID_SOURCE = 1001,
  NO_ANALYTICS = 1002,
  NOT_INITIALISED = 1003,
  INVALID_PLAYER = 1004,
  CONNECTION_ERROR = 1005,
  CONNECTION_TIMEOUT = 1006,
  MALFORMED_URL = 1007,
  NO_LIVEPAUSE = 1008,
  NON_YOSPACE_URL = 1009,
  HLS_SOURCE_MISSING = 1010,
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
  message: string;
  data: { [key: string]: any };
}

export interface YospacePolicyErrorEvent extends YospaceEventBase {
  code: YospacePolicyErrorCode;
  name: string;
}

export interface YospaceEventBase {
  timestamp: number;
  type: YospacePlayerEvent;
}

export interface YospacePlayerEventCallback {
  (event: PlayerEventBase | YospaceEventBase): void;
}
