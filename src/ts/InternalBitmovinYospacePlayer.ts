import {
  AdBreak,
  Advert,
  AdvertWrapper,
  BreakType,
  CONNECTION_ERROR,
  CONNECTION_TIMEOUT,
  DebugFlags,
  Event as YospaceInitEvent,
  MALFORMED_URL,
  PlayerEvent as YsPlayerEvent,
  ResourceType,
  Session,
  SessionDVRLive,
  SessionLive,
  SessionProperties,
  SessionState,
  SessionVOD,
  TimedMetadata,
  UNKNOWN_FORMAT,
  YoLog,
} from '@yospace/admanagement-sdk';

import type {
  AdEvent,
  AdQuartile,
  AdQuartileEvent,
  BufferLevel,
  BufferType,
  MediaType,
  MetadataEvent,
  PlaybackEvent,
  PlayerAPI,
  PlayerBufferAPI,
  PlayerEvent,
  PlayerEventBase,
  PlayerEventCallback,
  SeekEvent,
  SourceConfig,
  TimeChangedEvent,
  TimeMode,
  TimeRange,
} from 'bitmovin-player/modules/bitmovinplayer-core';

import {
  BYSAdBreakEvent,
  BYSAdEvent,
  BYSAnalyticsFiredEvent,
  BYSListenerCallbackFunction,
  BYSListenerEvent,
  BYSTrackingEventType,
  YospaceAdListenerAdapter,
} from './YospaceListenerAdapter';
import { DefaultBitmovinYospacePlayerPolicy } from './BitmovinYospacePlayerPolicy';
import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';
import {
  AdImmunityConfig,
  AdImmunityConfiguredEvent,
  AdImmunityEndedEvent,
  AdImmunityStartedEvent,
  BitmovinYospacePlayerAPI,
  BitmovinYospacePlayerPolicy,
  CompanionAdType,
  YospaceAdBreak,
  YospaceAdBreakEvent,
  YospaceAdBreakPosition,
  YospaceAssetType,
  YospaceCompanionAd,
  YospaceConfiguration,
  YospaceErrorCode,
  YospaceErrorEvent,
  YospaceEventBase,
  YospacePlayerEvent,
  YospacePlayerEventCallback,
  YospacePolicyErrorCode,
  YospacePolicyErrorEvent,
  YospaceSourceConfig,
} from './BitmovinYospacePlayerAPI';
import { YospacePlayerError } from './YospaceError';
import type {
  CompanionAd,
  LinearAd,
  PlayerAdvertisingAPI,
  VastAdExtension,
  VastAdExtensionAttributes,
} from 'bitmovin-player/modules/bitmovinplayer-advertising-core';
import { Logger } from './Logger';
import { DateRangeEmitter } from './DateRangeEmitter';
import { BitmovinYospaceHelper, EmsgSchemeIdUri } from './BitmovinYospaceHelper';
import stringify from 'fast-safe-stringify';
import { XmlNode } from '@yospace/admanagement-sdk/types/Core/XmlNode';

import { BitmovinId3FramesExtractor, Frame } from './BitmovinId3FramesExtractor';

const toSeconds = (ms: number): number => ms / 1000;
const toMilliseconds = (s: number): number => s * 1000;

const DEFAULT_AD_BREAK_TEMPLATE_OBJECT = { duration: -1, active: false, id: '', scheduleTime: -1 };

interface StreamPart {
  start: number;
  end: number;
  adBreak?: AdBreak;
}

// TODO: remove this when it's available in the Player
export interface YospaceLinearAd extends LinearAd {
  extensions: VastAdExtension[];
  adSystem?: string;
  companionAds?: YospaceCompanionAd[];
  sequence: number;
  creativeId: string;
  advertiser: string;
  lineage: unknown[];
}

// It is expected that this does not implement all members of the PlayerAPI cause they will be added dynamically.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class InternalBitmovinYospacePlayer implements BitmovinYospacePlayerAPI {
  // Bitmovin Player
  private readonly player: PlayerAPI;
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[] } = {};

  // Yospace fields
  private yospaceConfig: YospaceConfiguration;
  private yospaceSourceConfig?: YospaceSourceConfig;
  private _session: Session | null;
  private yospaceListenerAdapter?: YospaceAdListenerAdapter;
  private playerPolicy?: BitmovinYospacePlayerPolicy;

  private adParts: StreamPart[] = [];
  // helper attribute to calculate current time during an ad in live streams
  private adStartedTimestamp: number | null;

  // save original seek target in case of seek will seek over an AdBreak to recover to this position
  private cachedSeekTarget: number | null;

  // Event handling
  private suppressedEventsController: EventSuppressController = new EventSuppressController();

  // Replay support
  private isPlaybackFinished = false;

  // save playback speed to restore after AdBreak
  private playbackSpeed = 1;

  // convert EXT-X-DATERANGE tags to EMSG events
  private dateRangeEmitter?: DateRangeEmitter;

  private startSent: boolean;

  private lastTimeChangedTime = 0;
  private adImmunityConfig: AdImmunityConfig = {
    duration: 0, // 0 duration = disabled
  };
  // Ad holiday offset for discovering upcoming ad breaks before an ad frame is shown to the user
  private defaultAdBreakCheckOffset = 0.3;
  private defaultDisablePassedAdBreaks = true;

  private adImmune = false;
  private adImmunityCountDown: number | null = null;
  private unpauseAfterSeek = false;

  // Holds the first timeChangedValue in case we have a DVRLIVE asset. See onTimeChanged for details.
  private streamStartTimeOffset = 0;

  constructor(containerElement: HTMLElement, player: PlayerAPI, yospaceConfig: YospaceConfiguration = {}) {
    this.yospaceConfig = yospaceConfig;
    Logger.log('[BitmovinYospacePlayer] loading YospacePlayer with config= ' + stringify(this.yospaceConfig));

    this.player = player;
    this._session = null;
    this.adStartedTimestamp = null;
    this.cachedSeekTarget = null;
    this.startSent = false;

    if (BitmovinYospaceHelper.isSafari() || BitmovinYospaceHelper.isSafariIOS()) {
      this.dateRangeEmitter = new DateRangeEmitter(this.player, this.eventHandlers);
    }

    this.wrapPlayer();
  }

  get session(): Session | null {
    return this._session;
  }

  set session(value: Session | null) {
    this._session = value;
    if (this.dateRangeEmitter) {
      this.dateRangeEmitter.session = this._session;
    }
  }

  forceSeek(time: number, issuer?: string): boolean {
    return this.player.seek(this.toAbsoluteTime(time), issuer);
  }

  load(source: YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.resetState();
      const url: string = source.hls || source.dash || '';

      if (url === '') {
        const yospaceError = new YospacePlayerError(YospaceErrorCode.SUPPORTED_SOURCE_MISSING);
        this.handleYospaceError(yospaceError);
        reject(yospaceError);
        return;
      }

      this.yospaceSourceConfig = source;

      this.registerPlayerEvents();

      const onInitComplete = (event: YospaceInitEvent) => {
        const session: Session = event.getPayload();
        const state = session.getSessionState();
        const code = session.getResultCode();

        const getYospaceError = (): YospacePlayerError => {
          let errorCode: YospaceErrorCode;
          let detailedErrorCode: YospaceErrorCode;
          let detailedErrorMessage: string | undefined;

          // Collect error details
          switch (code) {
            case CONNECTION_ERROR:
              detailedErrorCode = YospaceErrorCode.CONNECTION_ERROR;
              break;
            case CONNECTION_TIMEOUT:
              detailedErrorCode = YospaceErrorCode.CONNECTION_TIMEOUT;
              break;
            case MALFORMED_URL:
              detailedErrorCode = YospaceErrorCode.MALFORMED_URL;
              break;
            case UNKNOWN_FORMAT:
              detailedErrorCode = YospaceErrorCode.UNKNOWN_FORMAT;
              break;
            default:
              // if the result is an number and greater than 0 it represents the http status code
              detailedErrorMessage = code > 0 ? `HTTP status code ${code}` : undefined;
              detailedErrorCode = YospaceErrorCode.UNKNOWN_ERROR;
          }

          // Detect general error
          if (state === SessionState.NO_ANALYTICS) {
            errorCode = YospaceErrorCode.NO_ANALYTICS;
          } else if (state !== SessionState.INITIALISED) {
            errorCode = YospaceErrorCode.NOT_INITIALISED;
          } else {
            errorCode = detailedErrorCode;
          }

          return new YospacePlayerError(errorCode, {
            errorCode: detailedErrorCode,
            errorMessage: detailedErrorMessage || `${errorCode}/${YospaceErrorCode[detailedErrorCode]}`,
          });
        };

        if (state === SessionState.INITIALISED) {
          this.session = session;

          this.calculateAdParts();
          const clonedSource: SourceConfig = source.hls
            ? {
                ...source,
                hls: this.session.getPlaybackUrl(), // use received url from yospace
                dash: undefined,
              }
            : {
                ...source,
                dash: this.session.getPlaybackUrl(), // use received url from yospace
                hls: undefined,
              };

          // convert start time (relative) to an absolute time
          if (this.yospaceSourceConfig?.assetType === YospaceAssetType.VOD && clonedSource.options && clonedSource.options.startOffset) {
            clonedSource.options.startOffset = this.toAbsoluteTime(clonedSource.options.startOffset);
            Logger.log('startOffset adjusted to: ' + clonedSource.options.startOffset);
          }

          this.yospaceListenerAdapter = new YospaceAdListenerAdapter();
          this.bindYospaceEvent();
          this.session.addAnalyticObserver(this.yospaceListenerAdapter);

          // Initialize policy
          if (!this.playerPolicy) {
            // TODO: Check if we can fix the type to avoid the unknown casting
            this.playerPolicy = new DefaultBitmovinYospacePlayerPolicy(this as unknown as BitmovinYospacePlayerAPI);
          }

          Logger.log('Loading Source: ' + stringify(clonedSource));
          try {
            this.player.load(clonedSource, forceTechnology, disableSeeking).then(this.pullYospaceAdDataForLive).then(resolve).catch(reject);
          } catch (e) {
            reject(e);
          }
        } else {
          session.shutdown();
          this.session = null;

          const yospaceError = getYospaceError();
          this.handleYospaceError(yospaceError);
          reject(yospaceError);
        }
      };

      const properties = new SessionProperties();
      properties.setUserAgent(navigator.userAgent);

      if (this.yospaceConfig.debugYospaceSdk) {
        YoLog.setDebugFlags(DebugFlags.DEBUG_ALL);
      }

      switch (source.assetType) {
        case YospaceAssetType.LINEAR:
          SessionLive.create(url, properties, onInitComplete);
          break;
        case YospaceAssetType.VOD:
          SessionVOD.create(url, properties, onInitComplete);
          break;
        case YospaceAssetType.DVRLIVE:
          SessionDVRLive.create(url, properties, onInitComplete);
          break;
        default:
          Logger.error('Undefined YospaceSourceConfig.assetType; Could not obtain session;');
      }
    });
  }

  get ads(): PlayerAdvertisingAPI {
    return this.advertisingApi;
  }

  get buffer(): PlayerBufferAPI {
    return this.bufferApi;
  }

  setPolicy(policy: BitmovinYospacePlayerPolicy) {
    this.playerPolicy = policy;
  }

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void;
  off(eventType: YospacePlayerEvent, callback: YospacePlayerEventCallback): void;
  off(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void {
    if (!EnumHelper.isYospaceEvent(eventType)) {
      this.player.off(eventType as PlayerEvent, callback);
    }
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  on(eventType: YospacePlayerEvent, callback: YospacePlayerEventCallback): void;
  on(eventType: PlayerEvent, callback: PlayerEventCallback): void;
  on(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void {
    if (!EnumHelper.isYospaceEvent(eventType)) {
      // we need to suppress some events because they need to be modified first. so don't add it to the actual player
      const suppressedEventTypes = [
        this.player.exports.PlayerEvent.TimeChanged,
        this.player.exports.PlayerEvent.Paused,
        this.player.exports.PlayerEvent.Seeked,
        this.player.exports.PlayerEvent.Seek,

        // Suppress all ad events
        this.player.exports.PlayerEvent.AdBreakFinished,
        this.player.exports.PlayerEvent.AdBreakStarted,
        this.player.exports.PlayerEvent.AdError,
        this.player.exports.PlayerEvent.AdFinished,
        this.player.exports.PlayerEvent.AdLinearityChanged,
        this.player.exports.PlayerEvent.AdManifestLoaded,
        this.player.exports.PlayerEvent.AdQuartile,
        this.player.exports.PlayerEvent.AdSkipped,
        this.player.exports.PlayerEvent.AdStarted,
      ];

      const event = eventType as PlayerEvent;
      if (!suppressedEventTypes.includes(event)) {
        this.player.on(event, callback);
      }
    } else {
      if (!this.eventHandlers[eventType]) {
        this.eventHandlers[eventType] = [];
      }

      this.eventHandlers[eventType as YospacePlayerEvent].push(callback as YospacePlayerEventCallback);
    }
  }

  play(issuer?: string): Promise<void> {
    if (this.isPlaybackFinished) {
      this.suppressedEventsController.add(this.player.exports.PlayerEvent.Seek, this.player.exports.PlayerEvent.Seeked);
      this.player.seek(0);
      this.isPlaybackFinished = false;
    }

    return this.player.play(issuer);
  }

  private pullYospaceAdDataForLive = (): Promise<void> => {
    if (
      (this.yospaceSourceConfig?.assetType !== YospaceAssetType.DVRLIVE &&
        this.yospaceSourceConfig?.assetType !== YospaceAssetType.LINEAR) ||
      this.startSent
    ) {
      // Manually triggering the Yospace ad data update is only needed for Live and DVRLive sessions, and only the first time the stream is started.
      return Promise.resolve();
    }

    const adDataUpdatedPromise = new Promise<void>((resolve) => {
      const onAnalyticUpdate = () => {
        this.yospaceListenerAdapter?.removeListener(BYSListenerEvent.ANALYTIC_UPDATED, onAnalyticUpdate);
        resolve();
      };

      this.yospaceListenerAdapter?.addListener(BYSListenerEvent.ANALYTIC_UPDATED, onAnalyticUpdate);
    });

    this.session?.onPlayerEvent(YsPlayerEvent.PLAYBACK_READY, 0);

    return adDataUpdatedPromise;
  };

  pause(issuer?: string): void {
    if (this.playerPolicy?.canPause()) {
      this.player.pause(issuer);
    } else {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.PAUSE_NOT_ALLOWED);
    }
  }

  mute(issuer?: string): void {
    if (this.playerPolicy?.canMute()) {
      this.player.mute(issuer);
    } else {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.MUTE_NOT_ALLOWED);
    }
  }

  /**
   * If policy.canSeekTo returns another position than the target, the player will restore to the original seek
   * position after the ads finished / skipped
   */
  seek(time: number, issuer?: string): boolean {
    // do not use this seek method for seeking within ads (skip) use player.seek(…) instead
    if (!this.playerPolicy?.canSeek()) {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.SEEK_NOT_ALLOWED);
      return false;
    }

    // set all breaks seeked past during immunity to inactive
    // this prevents the default player policy from redirecting
    // the seek target
    if (this.adImmune) {
      const currentTime = this.player.getCurrentTime();

      this.session?.getAdBreaksByType(BreakType.LINEAR).forEach((adBreak) => {
        const breakStart = this.toMagicTime(toSeconds(adBreak.getStart()));

        // Check if break is being seeked past and deactivate it
        if (breakStart > currentTime && breakStart <= time && this.adImmunityConfig.disablePassedAdBreaks) {
          Logger.log('[BitmovinYospacePlayer] Ad Immunity deactivated ad break during seek', adBreak);
          adBreak.setInactive();
        }
      });
    }

    const allowedSeekTarget = this.playerPolicy.canSeekTo(time);

    if (allowedSeekTarget !== time) {
      // cache original seek target
      this.cachedSeekTarget = time;
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.SEEK_TO_NOT_ALLOWED);
    } else {
      this.cachedSeekTarget = null;
    }
    const magicSeekTarget = this.toAbsoluteTime(allowedSeekTarget);

    Logger.log('Seek: ' + time + ' -> ' + magicSeekTarget);
    return this.player.seek(magicSeekTarget, issuer);
  }

  getCurrentTime(mode?: TimeMode): number {
    if (mode === 'absolutetime') {
      return this.player.getCurrentTime();
    }

    const currentAd = this.getCurrentAd();

    if (this.isAdActive() && currentAd) {
      // return currentTime in AdBreak
      const currentAdPosition = this.player.getCurrentTime();
      return currentAdPosition - this.getAdStartTime(currentAd);
    }

    return this.toMagicTime(this.player.getCurrentTime());
  }

  getDuration(mode?: TimeMode): number {
    if (!this.session) return 0;

    if (mode === 'absolutetime') {
      return this.player.getDuration();
    }

    if (this.isAdActive()) {
      return this.getCurrentAdDuration();
    }

    if (this.isLive()) {
      return this.player.getDuration();
    }

    if (!(this.session instanceof SessionVOD)) {
      return this.player.getDuration();
    }

    return toSeconds(this.session.getContentPositionForPlayhead(toMilliseconds(this.player.getDuration())));
  }

  /**
   * @deprecated Use {@link PlayerBufferAPI.getLevel} instead.
   */
  getVideoBufferLength(): number | null {
    return this.buffer.getLevel(this.player.exports.BufferType.ForwardDuration, this.player.exports.MediaType.Video).level;
  }

  /**
   * @deprecated Use {@link PlayerBufferAPI.getLevel} instead.
   */
  getAudioBufferLength(): number | null {
    return this.buffer.getLevel(this.player.exports.BufferType.ForwardDuration, this.player.exports.MediaType.Audio).level;
  }

  getBufferedRanges(): TimeRange[] {
    if (this.isLive()) {
      return this.player.getBufferedRanges();
    }

    const playerBufferedRanges = this.player.getBufferedRanges();
    const magicBufferedRanges: TimeRange[] = [];

    const currentAd = this.getCurrentAd();

    if (this.isAdActive() && currentAd) {
      // Only return ranges within the active ad
      const adStart = this.getAdStartTime(currentAd);
      const adEnd = adStart + this.getAdDuration(currentAd);

      playerBufferedRanges.forEach((range) => {
        const magicStart = Math.max(adStart, range.start);
        const magicEnd = Math.min(adEnd, range.end);

        // Filter ranges that are not in current adParts by checking if end is greater as the start timestamp
        if (magicEnd > magicStart) {
          magicBufferedRanges.push({
            start: magicStart - adStart,
            end: magicEnd - adStart,
          });
        }
      });
    } else {
      playerBufferedRanges.forEach((range) => {
        const getAdAtTime = (time: number) => {
          return this.adParts.find((part) => part.start <= time && part.end >= time);
        };

        const adAtRangeStart = getAdAtTime(range.start);
        const adAtRangeEnd = getAdAtTime(range.end);

        let rangeStart: number = range.start;

        if (adAtRangeStart) {
          // If the start of the range is within an ad we have to modify the range start to the right content value.
          // Value should be adBreak finish timestamp and need to be mapped into magic time.
          // This value is then the magic start of the current range.
          rangeStart = adAtRangeStart.end;
        }
        const magicRangeStart = this.toMagicTime(rangeStart);

        let rangeEnd: number = range.end;
        if (adAtRangeEnd) {
          // If the end of the range is within an ad we have to modify the range end to the right content value.
          // Value should be adBreak start timestamp and need to be mapped into magic time.
          // This value is then the magic start of the current range.
          rangeEnd = adAtRangeEnd.start;
        }

        let magicRangeEnd = this.toMagicTime(rangeEnd);

        const adBreaksBeforeRangeStart = this.getAdBreaksBefore(rangeStart);
        const adBreaksBeforeRangeEnd = this.getAdBreaksBefore(rangeEnd);

        // Check if there are adBreaks within the range
        if (adBreaksBeforeRangeStart.length !== adBreaksBeforeRangeEnd.length) {
          const diff = adBreaksBeforeRangeEnd.filter((x) => !adBreaksBeforeRangeStart.includes(x));
          // Sum the getDuration of the delta adBreaks
          const sumOfAdBreakDurations = diff.reduce((sum, adBreak) => sum + toSeconds(adBreak.getDuration()), 0);
          // Subtract the sum from the modified range
          magicRangeEnd -= sumOfAdBreakDurations;
        }

        // It's possible that a range start and ends within an ad so the magic will map it to the same start and end
        // value. To filter them out we check if the end is greater than the start time.
        if (rangeEnd > rangeStart) {
          magicBufferedRanges.push({
            start: magicRangeStart,
            end: magicRangeEnd,
          });
        }
      });
    }

    return magicBufferedRanges;
  }

  setPlaybackSpeed(speed: number): void {
    if (!this.playerPolicy?.canChangePlaybackSpeed()) {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.CHANGE_PLAYBACK_SPEED_NOT_ALLOWED);
      return;
    }

    this.playbackSpeed = speed;
    this.player.setPlaybackSpeed(this.playbackSpeed);
  }

  setAdImmunityConfig(config: AdImmunityConfig) {
    this.adImmunityConfig = {
      disablePassedAdBreaks: this.defaultDisablePassedAdBreaks,
      ...this.adImmunityConfig,
      ...config,
    };
    Logger.log('[BitmovinYospacePlayer] Ad Immunity Configured:', this.adImmunityConfig);
    this.handleYospaceEvent<AdImmunityConfiguredEvent>({
      timestamp: Date.now(),
      type: YospacePlayerEvent.AdImmunityConfigured,
      config,
    });
  }

  getAdImmunityConfig() {
    return this.adImmunityConfig;
  }

  isAdImmunityActive() {
    return this.adImmune;
  }

  endAdImmunity() {
    this.endAdImmunityPeriod();
  }

  startAdImmunity() {
    this.startAdImmunityPeriod();
  }

  // Helper

  private endAdImmunityPeriod() {
    if (this.adImmunityCountDown !== null) {
      window.clearTimeout(this.adImmunityCountDown);
      this.adImmunityCountDown = null;
    }

    if (!this.adImmune) return;

    this.adImmune = false;
    Logger.log('[BitmovinYospacePlayer] Ad Immunity Ended');
    this.handleYospaceEvent<AdImmunityEndedEvent>({
      timestamp: Date.now(),
      type: YospacePlayerEvent.AdImmunityEnded,
    });
  }

  private startAdImmunityPeriod() {
    // only start a timer if a duration has been configured, and ad immunity is not
    // already active. Only enable for VOD content.
    if (this.adImmune || this.yospaceSourceConfig?.assetType !== YospaceAssetType.VOD) {
      return;
    } else if (this.adImmunityConfig.duration) {
      this.adImmune = true;

      this.adImmunityCountDown = window.setTimeout(() => {
        this.endAdImmunityPeriod();
      }, toMilliseconds(this.adImmunityConfig.duration));

      Logger.log('[BitmovinYospacePlayer] Ad Immunity Started, duration', this.adImmunityConfig.duration);
      this.handleYospaceEvent<AdImmunityStartedEvent>({
        timestamp: Date.now(),
        type: YospacePlayerEvent.AdImmunityStarted,
        duration: this.adImmunityConfig.duration,
      });
    }
  }

  private isAdActive(): boolean {
    return Boolean(this.getCurrentAd());
  }

  private isAdBreakActive(): boolean {
    return Boolean(this.getCurrentAdBreak());
  }

  private getCurrentAdDuration(): number {
    const currentAd = this.getCurrentAd();
    if (this.isAdActive() && currentAd) {
      return this.getAdDuration(currentAd);
    }

    return 0;
  }

  private getCurrentAd(): Advert | null {
    if (!this.session) {
      return null;
    }

    return this.session.getCurrentAdvert();
  }

  private getCurrentAdBreak(): AdBreak | null {
    if (!this.session) {
      return null;
    }

    return this.session.getCurrentAdBreak();
  }

  getYospaceSession(): Session | null {
    return this.session;
  }

  private fireEvent<E extends PlayerEventBase | YospaceEventBase>(event: E): void {
    if (this.eventHandlers[event.type]) {
      this.eventHandlers[event.type].forEach(
        // Trigger events to the customer application asynchronously using setTimeout(fn, 0). The Yospace SDK manages
        // the session state using time updates and other events, and if some event handlers (especially AdFinished)
        // takes too long to execute, the Yospace SDK might get into a wrong state, reporting advertEnd twice etc. This
        // can be avoided by enforcing the callback to be run as a separate point in the JS event loop.
        (callback: YospacePlayerEventCallback) => setTimeout(() => callback(event), 0),
        this,
      );
    }
  }

  private bindYospaceEvent() {
    if (!this.yospaceListenerAdapter) {
      return;
    }

    this.yospaceListenerAdapter.addListener(BYSListenerEvent.AD_BREAK_START, this.onAdBreakStarted as BYSListenerCallbackFunction);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ADVERT_START, this.onAdStarted as BYSListenerCallbackFunction);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ADVERT_END, this.onAdFinished as BYSListenerCallbackFunction);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.AD_BREAK_END, this.onAdBreakFinished as BYSListenerCallbackFunction);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ANALYTICS_FIRED, this.onAnalyticsFired as BYSListenerCallbackFunction);
  }

  private onAdBreakStarted = (event: BYSAdBreakEvent) => {
    Logger.log('[BitmovinYospacePlayer] yospaceListenerAdapter.AD_BREAK_START');
    this.player.setPlaybackSpeed(1);

    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player.exports.PlayerEvent.AdBreakStarted,
      event.adBreak ? this.mapAdBreak(event.adBreak) : null,
    );

    this.fireEvent<YospaceAdBreakEvent>(playerEvent);
  };

  private onAdStarted = (event: BYSAdEvent) => {
    this.handleAdStart(event.ad);
  };

  private handleAdStart = (currentAd: Advert) => {
    // We no longer support TrueX, guarding against potential TrueX
    // ads which may still get trafficked.
    if (currentAd.getProperty('AdSystem')?.getValue() === 'trueX') {
      Logger.warn('TrueX is no longer supported, all ads and configuration will be ignored');
    }

    const getCompanionType = (t: CompanionAdType): ResourceType => {
      switch (t) {
        case CompanionAdType.HtmlResource:
          return ResourceType.HTML;
        case CompanionAdType.IFrameResource:
          return ResourceType.IFRAME;
        case CompanionAdType.StaticResource:
          return ResourceType.STATIC;
        case CompanionAdType.UnknownResource:
          return ResourceType.UNKNOWN;
      }
    };

    const mapToYospaceCompanionAd = (companionAds: any[], type: CompanionAdType): YospaceCompanionAd[] =>
      companionAds.map((companionAd) => ({
        id: companionAd.getProperty('id')?.value,
        resource: {
          // getResource apparently requires the type here,
          // even though we already did getCompanionAdByType
          url: companionAd.getResource(getCompanionType(type)).getStringData(),
          type: type,
        },
        adSlotId: companionAd.getProperty('adSlotId')?.value,
        companionClickThroughURLTemplate: companionAd.getClickThroughUrl(),
        canBeShown: () => {
          const isVisible = companionAd.isVisible();

          Logger.log('[BitmovinYospacePlayer] - companion ad can be shown:', isVisible);

          return isVisible;
        },
        shownToUser: () => {
          Logger.log('[BitmovinYospacePlayer] - companion ad shown to user.');

          companionAd.setVisible(true);
        },
        hiddenFromUser: () => {
          Logger.log('[BitmovinYospacePlayer] - companion ad hidden from user.');

          companionAd.setVisible(false);
        },
        clickThroughUrlOpened: () => {
          Logger.log('[BitmovinYospacePlayer] - Triggering click through on companion ad.');
          companionAd.onClickThrough();
        },
        width: companionAd.getProperty('width')?.value,
        height: companionAd.getProperty('height')?.value,
      }));

    const yospaceCompanionAds: YospaceCompanionAd[] = [
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(ResourceType.STATIC), CompanionAdType.StaticResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(ResourceType.HTML), CompanionAdType.HtmlResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(ResourceType.IFRAME), CompanionAdType.IFrameResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(ResourceType.UNKNOWN), CompanionAdType.UnknownResource),
    ];

    const playerEvent = AdEventsFactory.createAdEvent(
      this.player,
      this.player.exports.PlayerEvent.AdStarted,
      this.getCurrentAd(),
      yospaceCompanionAds,
    );

    // Need to be set before fireEvent is fired as the UI will call getCurrentTime in the callback of the
    // AdStarted event
    if (this.isLive()) {
      // save start position of an ad within a live stream to calculate the current time within the ad
      this.adStartedTimestamp = this.player.getCurrentTime();
    }

    this.fireEvent<AdEvent>(playerEvent);
  };

  private onAdFinished = () => {
    const currentAd = this.getCurrentAd();

    const playerEvent = AdEventsFactory.createAdEvent(this.player, this.player.exports.PlayerEvent.AdFinished, currentAd);
    this.fireEvent<AdEvent>(playerEvent);
    this.adStartedTimestamp = null;
  };

  private onAdBreakFinished = () => {
    const adBreak = this.getCurrentAdBreak();

    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player.exports.PlayerEvent.AdBreakFinished,
      adBreak ? this.mapAdBreak(adBreak) : null,
    );

    this.fireEvent<YospaceAdBreakEvent>(playerEvent);

    this.startAdImmunityPeriod();

    if (this.cachedSeekTarget !== null) {
      this.seek(this.cachedSeekTarget, 'yospace-ad-skipping');
      this.cachedSeekTarget = null;
    }

    this.player.setPlaybackSpeed(this.playbackSpeed);
  };

  private onAnalyticsFired = (event: BYSAnalyticsFiredEvent) => {
    const isQuartileEvent = (eventName: BYSTrackingEventType) => {
      const yospaceQuartileEventNames = [
        'firstQuartile',
        'midpoint',
        'thirdQuartile',
        // In our domain logic the 'complete' event is handed via the `AdFinished` event so we can ignore it here
      ];

      return yospaceQuartileEventNames.includes(eventName);
    };

    if (isQuartileEvent(event.call_id)) {
      this.handleQuartileEvent(event.call_id);
    }
  };

  private mapAdBreak(ysAdBreak: AdBreak | null): YospaceAdBreak {
    if (!ysAdBreak) {
      Logger.log('[BitmovinYospacePlayer] - AdBreak is null, using default AdBreak template object');
      return DEFAULT_AD_BREAK_TEMPLATE_OBJECT;
    }
    return {
      id: ysAdBreak.getIdentifier(), // can be null
      // -0.001 offset required to not seek to after ad break using default canSeekTo policy
      scheduleTime: this.toMagicTime(toSeconds(ysAdBreak.getStart())) - 0.001,
      ads: ysAdBreak
        .getAdverts()
        .map(AdTranslator.mapYsAdvert)
        .filter((ad) => ad !== null) as YospaceLinearAd[],
      duration: toSeconds(ysAdBreak.getDuration()),
      position: ysAdBreak.getPosition() as YospaceAdBreakPosition,
      active: ysAdBreak.isActive(),
    };
  }

  private mapAdQuartile(quartileEvent: string): AdQuartile | null {
    switch (quartileEvent) {
      case 'firstQuartile':
        return this.player.exports.AdQuartile.FIRST_QUARTILE;
      case 'midpoint':
        return this.player.exports.AdQuartile.MIDPOINT;
      case 'thirdQuartile':
        return this.player.exports.AdQuartile.THIRD_QUARTILE;
      default:
        Logger.warn(`Unknown quartile event '${quartileEvent}'`);
        return null;
    }
  }

  private getAdBreaksBefore(position: number): AdBreak[] {
    const filteredParts = this.adParts.filter((part) => part.start < position && position >= part.end);
    return filteredParts.map((element) => element.adBreak).filter((adBreak): adBreak is AdBreak => adBreak !== undefined);
  }

  private getAdDuration(ad: Advert): number {
    return toSeconds(ad.getDuration());
  }

  private getAdStartTime(ad: Advert): number {
    if (this.isLive()) {
      return this.adStartedTimestamp || 0;
    }

    return toSeconds(ad.getStart());
  }

  private toMagicTime(playbackTime: number): number {
    if (this.isLive()) return playbackTime;
    if (!this.session) return playbackTime;

    if (!(this.session instanceof SessionVOD)) {
      return playbackTime;
    }

    /**
     * Provides a relative content playhead position to the client,
     * discounting the sum of all ad break durations prior to the
     * absolute playhead position provided. This allows the client
     * to return to the same content position if a VOD stream is
     * stopped before playback ends.
     */
    return toSeconds(this.session.getContentPositionForPlayhead(toMilliseconds(playbackTime)));
  }

  private toAbsoluteTime(relativeTime: number): number {
    if (this.yospaceSourceConfig?.assetType === YospaceAssetType.VOD) {
      if (!this.session) {
        return relativeTime;
      }

      if (!(this.session instanceof SessionVOD)) {
        return relativeTime;
      }

      /**
       * Provides an absolute playhead position to the client
       * calculating the sum of all ad break durations prior to
       * that absolute playhead position plus the relative content
       * playhead position. This allows the client to return to
       * the same content position if a VOD stream is stopped
       * before playback ends.
       */
      return toSeconds(this.session.getPlayheadForContentPosition(toMilliseconds(relativeTime)));
    } else {
      return relativeTime;
    }
  }

  private magicBufferLevel(bufferLevel: BufferLevel): number {
    if (this.isAdActive()) {
      return Math.min(bufferLevel?.level ?? Number.POSITIVE_INFINITY, this.getCurrentAdDuration());
    }

    const currentBufferLevel = bufferLevel?.level ?? 0;

    let futureBreakDurations = 0;
    const currentPlayerTime = this.player.getCurrentTime();
    const bufferedRange = currentPlayerTime + currentBufferLevel;

    this.adParts.map((part: StreamPart) => {
      if (part.start > currentPlayerTime && part.end < bufferedRange) {
        futureBreakDurations += part.end - part.start;
      } else if (part.start > currentPlayerTime && part.start < bufferedRange && part.end > bufferedRange) {
        futureBreakDurations += bufferedRange - part.start;
      }
    });

    return Math.max(currentBufferLevel - futureBreakDurations, 0);
  }

  private resetState(): void {
    // reset all local attributes
    this.unregisterPlayerEvents();
    if (this.session) {
      Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.STOP');
      this.session.onPlayerEvent(YsPlayerEvent.STOP, toMilliseconds(this.player.getCurrentTime()));
      this.session.shutdown();
      this.session = null;
    }

    this.endAdImmunityPeriod();

    if (this.dateRangeEmitter) {
      this.dateRangeEmitter.reset();
    }

    // should adImmunityConfig be reset here? If yes, it
    // would require configuration for each new video start
    this.adParts = [];
    this.adStartedTimestamp = null;
    this.cachedSeekTarget = null;
    this.startSent = false;
    this.streamStartTimeOffset = 0;
  }

  private handleQuartileEvent(adQuartileEventName: string): void {
    const quartile = this.mapAdQuartile(adQuartileEventName);
    if (!quartile) {
      return;
    }

    const playerEvent: AdQuartileEvent = {
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.AdQuartile,
      quartile: quartile,
    };

    this.fireEvent(playerEvent);
  }

  private handleYospaceError(error: YospacePlayerError) {
    this.handleYospaceEvent<YospaceErrorEvent>({
      timestamp: Date.now(),
      type: YospacePlayerEvent.YospaceError,
      code: error.code,
      name: error.name,
      message: error.message,
      data: error.data,
    });
  }

  private handleYospacePolicyEvent(code: YospacePolicyErrorCode): void {
    this.handleYospaceEvent<YospacePolicyErrorEvent>({
      timestamp: Date.now(),
      type: YospacePlayerEvent.PolicyError,
      code: code,
      name: YospacePolicyErrorCode[code],
    });
  }

  private handleYospaceEvent<E extends YospaceEventBase>(event: E): void {
    this.fireEvent(event);
  }

  private parseId3Tags(event: MetadataEvent, frames: Frame[] = []): TimedMetadata | null {
    const charsToStr = (arr: [number]) => {
      return arr
        .filter((char) => char > 31 && char < 127)
        .map((char) => String.fromCharCode(char))
        .join('');
    };

    const metadata = event.metadata as any;

    const yospaceMetadataObject: any = {
      startTime: event.start ? event.start : this.player.getCurrentTime(),
    };

    if (frames.length != 0) {
      metadata.frames = frames;
    }

    metadata.frames.forEach((frame: any) => {
      if (Array.isArray(frame.data)) {
        yospaceMetadataObject[frame.key] = charsToStr(frame.data);
      }
    });

    if (!yospaceMetadataObject.YMID || !yospaceMetadataObject.YSEQ || !yospaceMetadataObject.YTYP || !yospaceMetadataObject.YDUR) {
      // this was not a proper Yospace metadata but generic one and should not be passed to Yospace.
      return null;
    }

    return TimedMetadata.createFromMetadata(
      /* ymid */
      yospaceMetadataObject.YMID,
      /* yseq */
      yospaceMetadataObject.YSEQ,
      /* ytyp */
      yospaceMetadataObject.YTYP,
      /* ydur */
      yospaceMetadataObject.YDUR,
      /* playhead */
      toMilliseconds(yospaceMetadataObject.startTime),
    );
  }

  private mapEmsgToId3Tags(event: MetadataEvent): TimedMetadata | null {
    const metadata = event.metadata as any;
    const startTime = metadata.presentationTime ? metadata.presentationTime : (this.player.getCurrentTime() as any);

    /*
      Emsg box V0 vs V1 Yospace messageData needs to be parsed differently; hence the differentiation
      Note: this parsing logic for V1 in Yospace documentation is not available.
    */
    if (metadata.schemeIdUri === EmsgSchemeIdUri.V1_ID3) {
      // messageData is decoded as UTF-8; hence encode back to UintArray
      const textEncoder = new TextEncoder();
      try {
        const framesExtractor = new BitmovinId3FramesExtractor();
        const id3Frames = framesExtractor.extractId3FramesFromEmsg(textEncoder.encode(metadata.messageData));
        return this.parseId3Tags(event, id3Frames);
      } catch (e) {
        if (typeof e === 'string') {
          Logger.warn(e);
        } else if (typeof e === 'object' && e instanceof Error) {
          Logger.warn(e.message);
        }
        return null;
      }
    } else if (metadata.schemeIdUri === EmsgSchemeIdUri.V0_ID3_YOSPACE_PROPRIETARY) {
      const yospaceMetadataObject: any = {};
      const messageData: string = metadata.messageData;
      messageData.split(',').forEach((metadata: string) => {
        const tags = metadata.split('=');
        yospaceMetadataObject[tags[0]] = tags[1];
      });

      return TimedMetadata.createFromMetadata(
        /* ymid */
        yospaceMetadataObject.YMID,
        /* yseq */
        yospaceMetadataObject.YSEQ,
        /* ytyp */
        yospaceMetadataObject.YTYP,
        /* ydur */
        yospaceMetadataObject.YDUR,
        /* playhead */
        toMilliseconds(startTime),
      );
    } else {
      Logger.warn('Yospace integration encountered metadata that it cannot parse');
      return null;
    }
  }

  // Custom advertising module with overwritten methods
  private advertisingApi: PlayerAdvertisingAPI = {
    discardAdBreak: () => {
      Logger.warn('CSAI is not supported for yospace stream');
      return;
    },

    getActiveAdBreak: () => {
      const currentAdBreak = this.getCurrentAdBreak();
      if (!this.isAdBreakActive() || !currentAdBreak) {
        return null;
      }

      return this.mapAdBreak(currentAdBreak);
    },

    getActiveAd: () => {
      const activeAd = this.getCurrentAd();
      if (!this.isAdActive() || !activeAd) {
        return null;
      }

      return AdTranslator.mapYsAdvert(activeAd);
    },

    isLinearAdActive: () => {
      return this.isAdActive();
    },

    list: () => {
      if (!this.session) {
        return [];
      }

      // Yospace may report ad breaks that don't contain ads as they didn't get some for the ad server. These ad breaks
      // need to stay in the SDK as there might be AdBreak Impressions and other beacons Yospace might need to trigger.
      // These ad breaks wouldn't be visible to the user and have a duration of `0`. Yospace's recommendation for us
      // is to filter out ads with duration = 0.
      return (
        this.session
          .getAdBreaksByType(BreakType.LINEAR)
          .map((adBreak: AdBreak) => this.mapAdBreak(adBreak))
          // filter out ad breaks deactivated by ad immunity
          .filter((adBreak: YospaceAdBreak) => adBreak.active && adBreak.duration > 0)
      );
    },

    schedule: () => {
      return Promise.reject('CSAI is not supported for yospace stream');
    },

    skip: () => {
      if (this.isAdActive()) {
        if (this.playerPolicy?.canSkip() === 0) {
          const ad = this.getCurrentAd();
          const adBreak = this.getCurrentAdBreak();

          if (!ad || !adBreak) {
            const message = 'No AdBreak or Ad active, skipping not possible';
            Logger.warn(message);
            return Promise.reject(message);
          }

          const seekTarget = this.getAdStartTime(ad) + this.getAdDuration(ad);

          if (seekTarget >= this.player.getDuration()) {
            this.isPlaybackFinished = true;
            this.suppressedEventsController.add(
              this.player.exports.PlayerEvent.Paused,
              this.player.exports.PlayerEvent.Seek,
              this.player.exports.PlayerEvent.Seeked,
            );
            this.player.pause();
            this.player.seek(toSeconds(adBreak.getStart()) - 1); // -1 to be sure to don't have a frame of the ad visible
            this.fireEvent({
              timestamp: Date.now(),
              type: this.player.exports.PlayerEvent.PlaybackFinished,
            });
          } else {
            this.player.seek(seekTarget, 'ad-skip');
          }

          this.session?.onPlayerEvent(YsPlayerEvent.ADVERT_SKIP, toMilliseconds(this.player.getCurrentTime()));

          this.fireEvent({
            timestamp: Date.now(),
            type: this.player.exports.PlayerEvent.AdSkipped,
            ad: AdTranslator.mapYsAdvert(ad),
          } as AdEvent);
        } else {
          this.handleYospacePolicyEvent(YospacePolicyErrorCode.SKIP_NOT_ALLOWED);
        }
      }
      return Promise.resolve();
    },

    getModuleInfo: () => {
      // If no advertising module is provided besides the core (i.e. `ima` or `bitmovin`), everything still works but
      // getting the module info for analytics fails. Adding a fallback for this case.
      const moduleInfo = this.player.ads?.getModuleInfo() || { name: 'advertising', version: this.player.version };
      moduleInfo.name += '-yospace-integration';
      return moduleInfo;
    },
  };

  private registerPlayerEvents(): void {
    this.player.on(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.on(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.on(this.player.exports.PlayerEvent.Seeked, this.onSeeked);

    this.player.on(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.on(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    this.player.on(this.player.exports.PlayerEvent.Muted, this.onMuted);
    this.player.on(this.player.exports.PlayerEvent.Unmuted, this.onUnmuted);

    if (this.yospaceSourceConfig?.assetType === YospaceAssetType.LINEAR) {
      // To support ads in live streams we need to track metadata events
      this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
    }
  }

  private unregisterPlayerEvents(): void {
    this.player.off(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.off(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.off(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.off(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.off(this.player.exports.PlayerEvent.Seeked, this.onSeeked);
    this.player.off(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.off(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    this.player.off(this.player.exports.PlayerEvent.Muted, this.onMuted);
    this.player.off(this.player.exports.PlayerEvent.Unmuted, this.onUnmuted);

    // To support ads in live streams we need to track metadata events
    this.player.off(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
  }

  private onPlaying = () => {
    if (!this.startSent) {
      Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.START');
      this.startSent = true;

      const time = this.player.getCurrentTime();

      this.session?.onPlayerEvent(YsPlayerEvent.START, toMilliseconds(time));
    } else {
      Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.RESUME');
      this.session?.onPlayerEvent(YsPlayerEvent.RESUME, toMilliseconds(this.player.getCurrentTime()));
    }
  };

  private performBreakSkip(seekTarget: number) {
    this.player.pause();
    this.unpauseAfterSeek = true;

    if (this.cachedSeekTarget !== null) {
      this.player.seek(this.cachedSeekTarget, 'yospace-ad-skipping');
      this.cachedSeekTarget = null;
    } else {
      this.player.seek(seekTarget, 'yospace-ad-skipping');
    }
  }

  private onTimeChanged = (event: PlayerEventBase) => {
    const timeChangedEvent = event as TimeChangedEvent;

    // the offset is an attempt to prevent the first few frames of an ad
    // playing before the seek past the break has time to propagate
    const adBreakCheckOffset =
      typeof this.adImmunityConfig.adBreakCheckOffset === 'number'
        ? this.adImmunityConfig.adBreakCheckOffset
        : this.defaultAdBreakCheckOffset;
    const upcomingAdBreak: AdBreak | null = this.session?.getAdBreakForPlayhead(
      toMilliseconds(timeChangedEvent.time) + toMilliseconds(adBreakCheckOffset),
    );

    // exclude postrolls and unknown break positions from ad immunity to prevent seek loops at end of video
    if (upcomingAdBreak?.getPosition() !== 'postroll' && upcomingAdBreak?.getPosition() !== 'unknown') {
      // Seek past previously deactivated ad breaks
      if (upcomingAdBreak && !upcomingAdBreak.isActive()) {
        Logger.log('[BitmovinYospacePlayer] - Ad Immunity pausing and seeking past deactivated ad break');

        this.performBreakSkip(toSeconds(upcomingAdBreak.getStart() + upcomingAdBreak.getDuration()));

        // do not propagate time to the rest of the app, we want to seek past it
        return;
      }

      // seek past and deactivate ad breaks entered during ad immunity
      if (upcomingAdBreak && this.adImmune) {
        if (this.adImmunityConfig.disablePassedAdBreaks) {
          upcomingAdBreak.setInactive();
          Logger.log('[BitmovinYospacePlayer] - Ad Immunity pausing, seeking past and deactivating ad break');
        } else {
          Logger.log('[BitmovinYospacePlayer] - Ad Immunity pausing, seeking past but not deactivating ad break');
        }

        this.performBreakSkip(toSeconds(upcomingAdBreak.getStart() + upcomingAdBreak.getDuration()));

        // do not propagate time to the rest of the app, we want to seek past it
        return;
      }
    }

    // There is an outstanding bug on Safari mobile where upon exiting an ad break,
    // our TimeChanged event "rewinds" ~12 ms. This is a temporary fix.
    // If we report this "rewind" to Yospace, it results in duplicate ad events.
    const timeDifference = timeChangedEvent.time - this.lastTimeChangedTime;
    this.lastTimeChangedTime = timeChangedEvent.time;

    if (timeDifference >= 0 || timeDifference < -0.25) {
      let playheadTime: number;

      if (this.yospaceSourceConfig?.assetType === YospaceAssetType.DVRLIVE) {
        if (!this.streamStartTimeOffset) {
          // The `session.onPlayheadUpdate` requires to report the playback time relative from the point of joining
          // the stream, starting with 0. However, our player does not start at 0 when joining the stream.
          // Depending on the streaming technology (HLS vs DASH) this value is something else. Sometimes it's
          // `getMaxTimeShift()` but also other values were observed.
          // When we assume that the very first `timeChangeEvent` is the time of joining the stream, we can take
          // this value and use it as the offset for subsequent calculations.
          this.streamStartTimeOffset = this.player.getCurrentTime('relativetime' as any);
        }

        playheadTime = this.player.getCurrentTime('relativetime' as any) - this.streamStartTimeOffset;
      } else {
        playheadTime = timeChangedEvent.time;
      }

      Logger.log('[BitmovinYospacePlayer] - reporting playhead time to Yospace:', playheadTime);
      this.session?.onPlayheadUpdate(toMilliseconds(playheadTime));
    } else {
      Logger.warn('Encountered a small negative TimeChanged update, not reporting to Yospace. Difference was: ' + timeDifference);
    }

    // fire magic time-changed event
    this.fireEvent<TimeChangedEvent>({
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.TimeChanged,
      time: this.getCurrentTime(),
    });
  };

  private onPause = (event: PlayerEventBase) => {
    const playbackEvent = event as PlaybackEvent;

    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.PAUSE');
    this.session?.onPlayerEvent(YsPlayerEvent.PAUSE, toMilliseconds(this.player.getCurrentTime()));

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Paused)) {
      this.fireEvent(playbackEvent);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Paused);
    }
  };

  private onSeek = (event: PlayerEventBase) => {
    const seekEvent = event as SeekEvent;

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seek)) {
      this.fireEvent(seekEvent);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seek);
    }
  };

  private onSeeked = (event: PlayerEventBase) => {
    const seekEvent = event as SeekEvent;

    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.SEEK (from Seeked player event)');

    if (this.unpauseAfterSeek) {
      this.unpauseAfterSeek = false;
      this.play();
    }

    this.session?.onPlayerEvent(YsPlayerEvent.SEEK, toMilliseconds(this.player.getCurrentTime()));

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seeked)) {
      this.fireEvent(seekEvent);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seeked);
    }
  };

  private onStallStarted = () => {
    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.STALL');
    this.session?.onPlayerEvent(YsPlayerEvent.STALL, toMilliseconds(this.player.getCurrentTime()));
  };

  private onStallEnded = () => {
    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.PlayerEvent.CONTINUE');
    this.session?.onPlayerEvent(YsPlayerEvent.CONTINUE, toMilliseconds(this.player.getCurrentTime()));
  };

  private onMuted = () => {
    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.onVolumenChange(muted=true)');
    this.session?.onVolumeChange(true);
  };

  private onUnmuted = () => {
    Logger.log('[BitmovinYospacePlayer] - sending YospaceAdManagement.onVolumenChange(muted=false)');
    this.session?.onVolumeChange(false);
  };

  private onMetadata = (event: PlayerEventBase) => {
    const metadataEvent = event as MetadataEvent;

    const validTypes = ['ID3', 'EMSG', 'DATERANGE'];
    const type = metadataEvent.metadataType;

    if (!validTypes.includes(type) || !this.player.isLive()) {
      return;
    }

    let yospaceMetadataObject: TimedMetadata | null;
    if (type === 'ID3') {
      yospaceMetadataObject = this.parseId3Tags(metadataEvent);
    } else if (type === 'EMSG') {
      yospaceMetadataObject = this.mapEmsgToId3Tags(metadataEvent);
    } else {
      yospaceMetadataObject = null;
    }

    if (yospaceMetadataObject) {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.METADATA ' + stringify(yospaceMetadataObject));
      this.session?.onTimedMetadata(yospaceMetadataObject);
    } else {
      Logger.log('[BitmovinYospacePlayer] - found metadata but does not appear to be yospace related: ' + stringify(metadataEvent));
    }
  };

  private calculateAdParts(): void {
    const adParts = this.session?.getAdBreaksByType(BreakType.LINEAR).map((adBreak) => ({
      start: toSeconds(adBreak.getStart()),
      end: toSeconds(adBreak.getStart()) + toSeconds(adBreak.getDuration()),
      adBreak: adBreak,
    }));
    if (adParts) {
      this.adParts = adParts;
    }
  }

  private bufferApi: PlayerBufferAPI = {
    setTargetLevel: (type: BufferType, value: number, media: MediaType) => {
      this.player.buffer.setTargetLevel(type, value, media);
    },

    getLevel: (type: BufferType, media: MediaType) => {
      const bufferLevel = this.player.buffer.getLevel(type, media);
      bufferLevel.level = this.magicBufferLevel(bufferLevel);
      return bufferLevel;
    },
  };

  unload(): Promise<void> {
    if (this.isAdActive()) {
      this.ads.skip();
    }
    this.resetState();
    return this.player.unload();
  }

  destroy(): Promise<void> {
    if (this.isAdActive()) {
      this.ads.skip();
    }
    this.resetState();
    return this.player.destroy();
  }

  // Needed in BitmovinYospacePlayerPolicy.ts so keep it here
  isLive(): boolean {
    return this.player.isLive();
  }

  // Add default PlayerAPI implementation to the yospacePlayer
  private wrapPlayer(): void {
    // Collect all members of the player (public API methods and properties of the player)
    const members: string[] = [];
    for (const member in this.player) {
      members.push(member);
    }

    // Split the members into methods and properties
    const methods = <any[]>[];
    const properties = <any[]>[];

    for (const member of members) {
      if (typeof (<any>this.player)[member] === 'function') {
        methods.push(member);
      } else {
        properties.push(member);
      }
    }

    const player = this.player;

    // Add function wrappers for all API methods that do nothing but calling the base method on the player
    for (const method of methods) {
      // Only add methods that are not already present
      if (typeof (this as any)[method] !== 'function') {
        (this as any)[method] = function () {
          return (player as any)[method].apply(player, arguments);
        };
      }
    }

    // Add all public properties of the player to the wrapper
    for (const property of properties) {
      // Get an eventually existing property descriptor to differentiate between plain properties and properties with
      // getters/setters.
      // Only add properties that are not already present
      if (!(this as any)[property]) {
        const propertyDescriptor =
          Object.getOwnPropertyDescriptor(this.player, property) ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.player), property);

        // If the property has getters/setters, wrap them accordingly...
        if (propertyDescriptor && (propertyDescriptor.get || propertyDescriptor.set)) {
          Object.defineProperty(this as any, property, {
            get: () => propertyDescriptor && propertyDescriptor.get && propertyDescriptor.get.call(this.player),
            set: (value: any) => propertyDescriptor && propertyDescriptor.set && propertyDescriptor.set.call(this.player, value),
            enumerable: true,
          });
        }
        // ... else just transfer the property to the wrapper
        else {
          (this as any)[property] = (<any>this.player)[property];
        }
      }
    }
  }
}

class AdTranslator {
  static mapYsAdvert(ysAd: Advert | null): LinearAd | null {
    if (!ysAd || ysAd.isNonLinear()) {
      return null;
    }

    const ysVastExtensions = ysAd.getExtensions();
    const extensions = ysVastExtensions ? [AdTranslator.YsXmlNodeToBmVastAdExtensions(ysVastExtensions)] : [];

    const lineage: AdvertWrapper = ysAd.getLineage();

    return {
      isLinear: !ysAd.isNonLinear(),
      duration: toSeconds(ysAd.getDuration()),
      id: ysAd.getIdentifier(),
      creativeId: ysAd.getLinearCreative().getCreativeIdentifier(),
      adTitle: ysAd.getProperty('AdTitle')?.getValue(),
      advertiser: ysAd.getProperty('Advertiser')?.getValue(),
      lineage: lineage ? [lineage] : [],
      // height/width not available for ads that are stitched
      height: 0,
      width: 0,
      clickThroughUrl: ysAd.getLinearCreative()?.getClickThroughUrl() || '',
      skippableAfter: toSeconds(ysAd.getSkipOffset()),
      uiConfig: {
        // Previously:
        // Check if ad is VPAID, if yes, hide the requestUi.
        // VPAID is no longer supported in yospace v3.
        //
        // requestsUi: !ysAd.hasInteractiveUnit(),
        requestsUi: true,
      },
      // ysAd.getExtensions returns a single VastAdExtension
      // with nested VastAdExtensions, or null
      extensions: extensions,
      adSystem: ysAd.getProperty('AdSystem')?.getValue(),
      sequence: ysAd.getSequence(),
      isFiller: ysAd.isFiller(),
    } as YospaceLinearAd;
  }

  static YsXmlNodeToBmVastAdExtensions(ysVastExtension: XmlNode): VastAdExtension {
    const value = ysVastExtension.getInnerText();
    const name = ysVastExtension.getName();

    const attributes: VastAdExtensionAttributes = {};
    ysVastExtension.getAttributes().forEach((value, key) => (attributes[String(key)] = String(value)));

    // XmlNode.getChildren returns `XmlNode[]` but according to the type definitions it returns `XmlNode`.
    // Casting to `unknown` and then to `XmlNode[]` is a workaround to use it without casting to `any`.
    const ysExtChildren = ysVastExtension.getChildren() as unknown as XmlNode[];
    const children: VastAdExtension[] = [];
    ysExtChildren.forEach((child) => children.push(AdTranslator.YsXmlNodeToBmVastAdExtensions(child)));

    return {
      value,
      name,
      attributes,
      children,
    };
  }
}

class AdEventsFactory {
  static createAdBreakEvent(type: PlayerEvent, adBreak: YospaceAdBreak | null): YospaceAdBreakEvent {
    return {
      timestamp: Date.now(),
      type: type,
      adBreak: adBreak,
    };
  }

  static createAdEvent(player: PlayerAPI, type: PlayerEvent, ad: Advert | null, companionAds?: CompanionAd[]): AdEvent {
    return {
      timestamp: Date.now(),
      type: type,
      ad: {
        clickThroughUrlOpened: () => {
          if (ad) {
            Logger.log('[BitmovinYospacePlayer] - triggering click through on ad.');
            ad.getLinearCreative()?.onClickThrough();
          } else {
            Logger.warn('[BitmovinYospacePlayer] - click through on ad triggered, but no ad details are available.');
          }
        },
        ...AdTranslator.mapYsAdvert(ad),
        companionAds: companionAds,
      } as YospaceLinearAd,
    };
  }
}

class EventSuppressController {
  private suppressedEvents: PlayerEvent[] = [];

  add(...items: PlayerEvent[]) {
    for (const item of items) {
      if (!this.isSuppressed(item)) {
        this.suppressedEvents.push(item);
      }
    }
  }

  remove(...items: PlayerEvent[]) {
    for (const item of items) {
      ArrayUtils.remove(this.suppressedEvents, item);
    }
  }

  isSuppressed(eventType: PlayerEvent): boolean {
    return this.suppressedEvents.includes(eventType);
  }
}

class EnumHelper {
  static isYospaceEvent(eventType: PlayerEvent | YospacePlayerEvent) {
    return (<any>Object).values(YospacePlayerEvent).includes(eventType);
  }
}
