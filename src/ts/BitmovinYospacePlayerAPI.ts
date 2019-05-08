import {
  PlayerAPI,
  PlayerEvent,
  PlayerEventBase,
  PlayerEventCallback,
  PlayerExports,
  SourceConfig,
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

// Public API

export interface BitmovinYospacePlayerAPI extends PlayerAPI {
  readonly exports: BitmovinYospacePlayerExports;

  load(source: SourceConfig | YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void>;
  on(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;
  off(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void;
  setPolicy(policy: BitmovinYospacePlayerPolicy): void;
  getCurrentPlayerType(): YospacePlayerType;
}

export interface YospaceSourceConfig extends SourceConfig {
  assetType: YospaceAssetType;
}

export interface YospaceConfiguration {
  debug?: boolean;
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
