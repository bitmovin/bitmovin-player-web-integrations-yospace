import {
  AdBreak,
  CompanionAd,
  PlayerAPI,
  PlayerEvent,
  PlayerEventBase,
  PlayerEventCallback,
  PlayerExports,
  SourceConfig,
} from 'bitmovin-player';
import { TimeMode } from 'bitmovin-player/modules/bitmovinplayer-core';

// Enums

export enum YospaceAssetType {
  LINEAR,
  VOD,
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

  load(source: SourceConfig | YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void>;

  on(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;

  off(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;

  setPolicy(policy: BitmovinYospacePlayerPolicy): void;

  getCurrentPlayerType(): YospacePlayerType;

  /*
   * By default, the method returns the current content position, discarding stitched ad durations. If an ad
   * is playing, the position inside of the ad will instead be returned.
   *
   * if TimeMode.AbsoluteTime is provided as an argument to the method, it will instead always return the current time
   * including stitched ad durations.
   */
  getCurrentTime(mode?: TimeMode): number;

  /*
   * By default, the method returns the current content duration, discarding stitched ad durations. If an ad
   * is playing, the duration of the ad will instead be returned.
   *
   * if TimeMode.AbsoluteTime is provided as an argument to the method, it will instead always return the duration
   * including stitched ad durations.
   */
  getDuration(mode?: TimeMode): number;

  forceSeek(time: number, issuer?: string): boolean;

  /**
   * Provide a duration greater than 0 to enable the ad immunity feature.
   * The user will become immune to ad breaks for the duration upon
   * fully watching an ad break.
   *
   * duration 0 disables the feature
   */
  setAdImmunityConfig(options: AdImmunityConfig): void;

  /**
   * Returns the current ad immunity configuration
   *
   * duration 0 means the feature is disabled
   */
  getAdImmunityConfig(): AdImmunityConfig;

  /**
   * Returns a boolean value indicating if the user is currently immune to ad breaks
   */
  isAdImmunityActive(): boolean;

  /**
   * Immediately ends an ongoing ad immunity period, before it would naturally expire
   */
  endAdImmunity(): void;
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
  active: boolean;
}

export interface YospaceAdBreakEvent extends PlayerEventBase {
  adBreak: YospaceAdBreak;
}

export interface YospaceCompanionAd extends CompanionAd {
  id: string;
  resource: CompanionAdResource;
  companionClickThroughURLTemplate?: string;
  canBeShown: () => boolean;
  shownToUser: () => void;
  hiddenFromUser: () => void;
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
  debugYospaceSdk?: boolean;
  disableServiceWorker?: boolean;
  disableStrictBreaks?: boolean;
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
  AdImmunityConfigured = 'adimmunityconfigured',
  AdImmunityStarted = 'adimmunitystarted',
  AdImmunityEnded = 'adimmunityended',
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
  // Deprecated
  // NO_LIVEPAUSE = 1008,
  // NON_YOSPACE_URL = 1009,
  // HLS_SOURCE_MISSING = 1010,
  UNKNOWN_FORMAT = 1011,
  SUPPORTED_SOURCE_MISSING = 1012,
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

export interface AdImmunityConfiguredEvent extends YospaceEventBase {
  type: YospacePlayerEvent.AdImmunityConfigured;
  config: { duration: number };
}

export interface AdImmunityStartedEvent extends YospaceEventBase {
  type: YospacePlayerEvent.AdImmunityStarted;
  duration: number;
}

export interface AdImmunityEndedEvent extends YospaceEventBase {
  type: YospacePlayerEvent.AdImmunityEnded;
}

export interface AdImmunityConfig {
  duration: number;
}
