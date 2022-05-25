///<reference path='Yospace.d.ts'/>

import {
  AdEvent,
  AdQuartile,
  AdQuartileEvent,
  BufferLevel,
  BufferType,
  MediaType,
  MetadataEvent,
  ModuleReadyEvent,
  PlaybackEvent,
  PlayerAPI,
  PlayerBufferAPI,
  PlayerEvent,
  PlayerEventBase,
  PlayerEventCallback,
  SeekEvent,
  TimeChangedEvent,
  TimeRange,
} from 'bitmovin-player/modules/bitmovinplayer-core';

import {
  BYSAdBreakEvent,
  BYSAdEvent,
  BYSAnalyticsFiredEvent,
  BYSListenerEvent,
  BYSTrackingEventType,
  YospaceAdListenerAdapter,
} from './YospaceListenerAdapter';
import { DefaultBitmovinYospacePlayerPolicy } from './BitmovinYospacePlayerPolicy';
import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';
import {
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
import {
  AdConfig,
  CompanionAd,
  LinearAd,
  PlayerAdvertisingAPI,
  VastAdExtension,
} from 'bitmovin-player/modules/bitmovinplayer-advertising-core';
import { Logger } from './Logger';
import { DateRangeEmitter } from './DateRangeEmitter';
import { BitmovinYospaceHelper } from './BitmovinYospaceHelper';
import stringify from 'fast-safe-stringify';

const toSeconds = (ms: number): number => ms / 1000;
const toMilliseconds = (s: number): number => s * 1000;

interface StreamPart {
  start: number;
  end: number;
  adBreak?: YSAdBreak;
}

// TODO: remove this when it's available in the Player
export interface YospaceLinearAd extends LinearAd {
  extensions: VastAdExtension[];
  adSystem?: string;
  companionAds?: YospaceCompanionAd[];
  sequence: number;
  creativeId: string;
  advertiser: string;
  lineage: any[];
}

// It is expected that this does not implement all members of the PlayerAPI cause they will be added dynamically.
// @ts-ignore
export class InternalBitmovinYospacePlayer implements BitmovinYospacePlayerAPI {
  // Bitmovin Player
  private readonly player: PlayerAPI;
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[]; } = {};

  // Yospace fields
  private yospaceConfig: YospaceConfiguration;
  private yospaceSourceConfig: YospaceSourceConfig;
  private _session: YSSession | null;
  private yospaceListenerAdapter: YospaceAdListenerAdapter;
  private playerPolicy: BitmovinYospacePlayerPolicy;

  private adParts: StreamPart[] = [];
  // helper attribute to calculate current time during an ad in live streams
  private adStartedTimestamp: number;

  // save original seek target in case of seek will seek over an AdBreak to recover to this position
  private cachedSeekTarget: number;

  // Event handling
  private suppressedEventsController: EventSuppressController = new EventSuppressController();

  // Replay support
  private isPlaybackFinished = false;

  // save playback speed to restore after AdBreak
  private playbackSpeed: number = 1;

  // convert EXT-X-DATERANGE tags to EMSG events
  private dateRangeEmitter: DateRangeEmitter;

  // save the truexAdFree state
  private truexAdFree: boolean;

  private startSent: boolean;

  private lastTimeChangedTime: number = 0;

  constructor(containerElement: HTMLElement, player: PlayerAPI, yospaceConfig: YospaceConfiguration = {}) {
    this.yospaceConfig = yospaceConfig;
    Logger.log('[BitmovinYospacePlayer] loading YospacePlayer with config= ' + stringify(this.yospaceConfig));

    this.player = player;
    this.session = null;

    if (BitmovinYospaceHelper.isSafari() || BitmovinYospaceHelper.isSafariIOS()) {
      this.dateRangeEmitter = new DateRangeEmitter(this.player, this.eventHandlers);
    }

    this.wrapPlayer();
  }

  get session(): YSSession | null {
    return this._session;
  }

  set session(value: YSSession | null) {
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
      // for now we only support hls source
      if (!source.hls) {
        this.resetState();
        this.handleYospaceError(new YospacePlayerError(YospaceErrorCode.HLS_SOURCE_MISSING));
        reject();
        return;
      }
      this.resetState();
      this.registerPlayerEvents();

      const url = source.hls;

      this.yospaceSourceConfig = source;
      const onInitComplete = (event: any) => {
        const session: YSSession = event.getPayload();
        const result = session.getSessionResult();
        const code = session.getResultCode();

        const getYospaceError = (): YospacePlayerError => {
          let errorCode: YospaceErrorCode;
          let detailedErrorCode: YospaceErrorCode;
          let detailedErrorMessage: string;

          // Detect general error
          if (result === YospaceAdManagement.SessionResult.NO_ANALYTICS) {
            errorCode = YospaceErrorCode.NO_ANALYTICS;
          } else if (result === YospaceAdManagement.SessionResult.NOT_INITIALISED) {
            errorCode = YospaceErrorCode.NOT_INITIALISED;
          }

          // Collect error details
          switch (code) {
            case YospaceAdManagement.CONNECTION_ERROR:
              detailedErrorCode = YospaceErrorCode.CONNECTION_ERROR;
              break;
            case YospaceAdManagement.CONNECTION_TIMEOUT:
              detailedErrorCode = YospaceErrorCode.CONNECTION_TIMEOUT;
              break;
            case YospaceAdManagement.MALFORMED_URL:
              detailedErrorCode = YospaceErrorCode.MALFORMED_URL;
              break;
            case YospaceAdManagement.UNKNOWN_FORMAT:
              detailedErrorCode = YospaceErrorCode.UNKNOWN_FORMAT;
              break;
            default:
              // if the result is an number and greater than 0 it represents the http status code
              detailedErrorMessage = code > 0 ? `HTTP status code ${code}` : undefined;
              detailedErrorCode = YospaceErrorCode.UNKNOWN_ERROR;
          }

          return new YospacePlayerError(errorCode, {
            errorCode: detailedErrorCode,
            errorMessage: detailedErrorMessage || `${errorCode}/${YospaceErrorCode[detailedErrorCode]}`,
          });
        };

        if (result === YospaceAdManagement.SessionResult.INITIALISED) {
          this.session = session;

          this.calculateAdParts();
          // clone source to not modify passed object
          let clonedSource = {
            ...source,
            hls: this.session.getPlaybackUrl(), // use received url from yospace
          };

          // convert start time (relative) to an absolute time
          if (this.yospaceSourceConfig.assetType === YospaceAssetType.VOD && clonedSource.options
            && clonedSource.options.startOffset) {
            clonedSource.options.startOffset = this.toAbsoluteTime(clonedSource.options.startOffset);
            Logger.log('startOffset adjusted to: ' + clonedSource.options.startOffset);
          }

          this.yospaceListenerAdapter = new YospaceAdListenerAdapter();
          this.bindYospaceEvent();
          this.session.addAnalyticObserver(this.yospaceListenerAdapter);

          // Initialize policy
          if (!this.playerPolicy) {
            this.playerPolicy = new DefaultBitmovinYospacePlayerPolicy(this as any as BitmovinYospacePlayerAPI);
          }

          Logger.log('Loading Source: ' + stringify(clonedSource));
          this.player.load(clonedSource, forceTechnology, disableSeeking).then(resolve).catch(reject);
        } else {
          session.shutdown();
          this.session = null;

          this.handleYospaceError(getYospaceError());
          reject();
        }
      };

      const properties = new YospaceAdManagement.SessionProperties({
        USE_ID3: source.assetType !== YospaceAssetType.VOD, // Use time based tracking only for VOD
      });

      properties.setUserAgent(navigator.userAgent);

      if (!this.yospaceConfig.disableStrictBreaks && source.assetType === YospaceAssetType.LINEAR) {
        Logger.log('[BitmovinYospacePlayer] enabling strict_breaks through Yospace SDK');
        properties.STRICT_BREAKS = true;
      }

      if (this.yospaceConfig.debug) {
        // TODO test debugging. Official docs missing for how to enable.
        // YospaceAdManagement.Session.DEBUGGING = YospaceAdManagement.DEBUG_ALL;
      }

      switch (source.assetType) {
        case YospaceAssetType.LINEAR:
          YospaceAdManagement.SessionLive.create(url, properties, onInitComplete);
          break;
        case YospaceAssetType.VOD:
          YospaceAdManagement.SessionVOD.create(url, properties, onInitComplete);
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
    }

    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);
  }

  play(issuer?: string): Promise<void> {
    if (this.isPlaybackFinished) {
      this.suppressedEventsController.add(this.player.exports.PlayerEvent.Seek, this.player.exports.PlayerEvent.Seeked);
      this.player.seek(0);
      this.isPlaybackFinished = false;
    }

    return this.player.play(issuer);
  }

  pause(issuer?: string): void {
    if (this.playerPolicy.canPause()) {
      this.player.pause();
    } else {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.PAUSE_NOT_ALLOWED);
    }
  }

  mute(issuer?: string): void {
    if (this.playerPolicy.canMute()) {
      this.player.mute();
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
    if (!this.playerPolicy.canSeek()) {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.SEEK_NOT_ALLOWED);
      return false;
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

  getCurrentTime(): number {
    if (this.isAdActive()) {
      // return currentTime in AdBreak
      const currentAdPosition = this.player.getCurrentTime();
      return currentAdPosition - this.getAdStartTime(this.getCurrentAd());
    }

    return this.toMagicTime(this.player.getCurrentTime());
  }

  getDuration(): number {
    if (!this.session) return 0;

    if (this.isAdActive()) {
      return this.getCurrentAdDuration();
    }

    if (this.isLive()) {
      return this.player.getDuration();
    }

    return toSeconds(
      this.session.getContentPositionForPlayhead(
        toMilliseconds(this.player.getDuration()),
      ),
    );
  }

  /**
   * @deprecated Use {@link PlayerBufferAPI.getLevel} instead.
   */
  getVideoBufferLength(): number | null {
    return this.buffer.getLevel(this.player.exports.BufferType.ForwardDuration,
      this.player.exports.MediaType.Video).level;
  }

  /**
   * @deprecated Use {@link PlayerBufferAPI.getLevel} instead.
   */
  getAudioBufferLength(): number | null {
    return this.buffer.getLevel(this.player.exports.BufferType.ForwardDuration,
      this.player.exports.MediaType.Audio).level;
  }

  getBufferedRanges(): TimeRange[] {
    if (this.isLive()) {
      return this.player.getBufferedRanges();
    }

    const playerBufferedRanges = this.player.getBufferedRanges();
    const magicBufferedRanges: TimeRange[] = [];

    if (this.isAdActive()) {
      // Only return ranges within the active ad
      const currentAd = this.getCurrentAd();
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
          rangeStart = getAdAtTime(range.start).end;
        }
        const magicRangeStart = this.toMagicTime(rangeStart);

        let rangeEnd: number = range.end;
        if (adAtRangeEnd) {
          // If the end of the range is within an ad we have to modify the range end to the right content value.
          // Value should be adBreak start timestamp and need to be mapped into magic time.
          // This value is then the magic start of the current range.
          rangeEnd = getAdAtTime(range.end).start;
        }

        let magicRangeEnd = this.toMagicTime(rangeEnd);

        const adBreaksBeforeRangeStart = this.getAdBreaksBefore(rangeStart);
        const adBreaksBeforeRangeEnd = this.getAdBreaksBefore(rangeEnd);

        // Check if there are adBreaks within the range
        if (adBreaksBeforeRangeStart.length !== adBreaksBeforeRangeEnd.length) {
          const diff = adBreaksBeforeRangeEnd.filter(x => !adBreaksBeforeRangeStart.includes(x));
          // Sum the getDuration of the delta adBreaks
          const sumOfAdBreakDurations = diff.reduce((sum, adBreak) => sum + (toSeconds(adBreak.getDuration())), 0);
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
    if (!this.playerPolicy.canChangePlaybackSpeed()) {
      this.handleYospacePolicyEvent(YospacePolicyErrorCode.CHANGE_PLAYBACK_SPEED_NOT_ALLOWED);
      return;
    }

    this.playbackSpeed = speed;
    this.player.setPlaybackSpeed(this.playbackSpeed);
  }

  // Helper
  private isAdActive(): boolean {
    return Boolean(this.getCurrentAd());
  }

  private getCurrentAdDuration(): number | null {
    if (this.isAdActive()) {
      return this.getAdDuration(this.getCurrentAd());
    }

    return null;
  }

  private getCurrentAd(): YSAdvert | null {
    if (!this.session) {
      return null;
    }

    return this.session.getCurrentAdvert();
  }

  private getCurrentAdBreak(): YSAdBreak | null {
    if (!this.session) {
      return null;
    }

    return this.session.getCurrentAdBreak();
  }

  getYospaceSession(): YSSession | null {
    return this.session;
  }

  private fireEvent<E extends PlayerEventBase | YospaceEventBase>(event: E): void {
    if (this.eventHandlers[event.type]) {
      this.eventHandlers[event.type].forEach((callback: YospacePlayerEventCallback) => callback(event));
    }
  }

  private bindYospaceEvent() {
    if (!this.yospaceListenerAdapter) {
      return;
    }

    this.yospaceListenerAdapter.addListener(BYSListenerEvent.AD_BREAK_START, this.onAdBreakStarted);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ADVERT_START, this.onAdStarted);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ADVERT_END, this.onAdFinished);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.AD_BREAK_END, this.onAdBreakFinished);
    this.yospaceListenerAdapter.addListener(BYSListenerEvent.ANALYTICS_FIRED, this.onAnalyticsFired);
  }

  private onAdBreakStarted = (event: BYSAdBreakEvent) => {
    Logger.log('[BitmovinYospacePlayer] yospaceListenerAdapter.AD_BREAK_START');
    this.player.setPlaybackSpeed(1);

    const adBreak = this.mapAdBreak(event.adBreak);
    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player.exports.PlayerEvent.AdBreakStarted,
      adBreak,
    );
    this.fireEvent<YospaceAdBreakEvent>(playerEvent);
  };

  private onAdStarted = (event: BYSAdEvent) => {
    this.handleAdStart(event.ad);
  };

  private handleAdStart = (currentAd: YSAdvert) => {
    // We no longer support TrueX, guarding against potential TrueX
    // ads which may still get trafficked.
    const isTruexAd = currentAd.getProperty('AdSystem')?.value === 'trueX';

    if (isTruexAd) {
      Logger.warn('TrueX is no longer supported, all ads and configuration will be ignored');
    }

    const getCompanionType = (t: CompanionAdType): YospaceAdManagement['ResourceType'] => {
      switch (t) {
        case CompanionAdType.HtmlResource:
          return YospaceAdManagement.ResourceType.HTML;
        case CompanionAdType.IFrameResource:
          return YospaceAdManagement.ResourceType.IFRAME;
        case CompanionAdType.StaticResource:
          return YospaceAdManagement.ResourceType.STATIC;
        case CompanionAdType.UnknownResource:
          return YospaceAdManagement.ResourceType.UNKNOWN;
      }
    };

    const mapToYospaceCompanionAd = (
      companionAds: any[],
      type: CompanionAdType,
    ): YospaceCompanionAd[] =>
    companionAds.map(companionAd => ({
      id: companionAd.getProperty('id')?.value,
      resource: {
        // getResource apparently requires the type here,
        // even though we already did getCompanionAdByType
        url: companionAd.getResource(getCompanionType(type)).getStringData(),
        type: type,
      },
      adSlotId: companionAd.getProperty('adSlotId')?.value,
      companionClickThroughURLTemplate: companionAd.getClickThroughUrl(),
      clickThroughUrlOpened: () => {
        Logger.log('[BitmovinYospacePlayer] - Triggering click through on companion ad.');
        companionAd.onClickThrough();
      },
      onTrackingEvent: (event: string) => companionAd.onTrackingEvent(event),
      // TODO wait for yospace support response for how to map
      companionClickTrackingURLTemplates: [],
      // TODO wait for yospace support response for how to map
      creativeTrackingEvents: [],
      width: companionAd.getProperty('width')?.value,
      height: companionAd.getProperty('height')?.value,
    }));

    const yospaceCompanionAds: YospaceCompanionAd[] = [
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(YospaceAdManagement.ResourceType.STATIC), CompanionAdType.StaticResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(YospaceAdManagement.ResourceType.HTML), CompanionAdType.HtmlResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(YospaceAdManagement.ResourceType.IFRAME), CompanionAdType.IFrameResource),
      ...mapToYospaceCompanionAd(currentAd.getCompanionAdsByType(YospaceAdManagement.ResourceType.UNKNOWN), CompanionAdType.UnknownResource),
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

    const playerEvent = AdEventsFactory.createAdEvent(
      this.player,
      this.player.exports.PlayerEvent.AdFinished,
      currentAd,
    );
    this.fireEvent<AdEvent>(playerEvent);
    this.adStartedTimestamp = null;
  };

  private onAdBreakFinished = () => {
    const adBreak = this.mapAdBreak(this.getCurrentAdBreak());

    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player.exports.PlayerEvent.AdBreakFinished,
      adBreak,
    );

    this.fireEvent<YospaceAdBreakEvent>(playerEvent);

    if (this.cachedSeekTarget) {
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

  private mapAdBreak(ysAdBreak: YSAdBreak): YospaceAdBreak {
    return {
      id: ysAdBreak.getIdentifier(), // can be null
      // -0.001 offset required to not seek to after ad break using default canSeekTo policy
      scheduleTime: this.toMagicTime(toSeconds(ysAdBreak.getStart())) - 0.001,
      ads: ysAdBreak.getAdverts().map(AdTranslator.mapYsAdvert),
      duration: toSeconds(ysAdBreak.getDuration()),
      position: ysAdBreak.getPosition() as YospaceAdBreakPosition,
    };
  }

  private mapAdQuartile(quartileEvent: string): AdQuartile {
    switch (quartileEvent) {
      case 'firstQuartile':
        return this.player.exports.AdQuartile.FIRST_QUARTILE;
      case 'midpoint':
        return this.player.exports.AdQuartile.MIDPOINT;
      case 'thirdQuartile':
        return this.player.exports.AdQuartile.THIRD_QUARTILE;
    }
  }

  private getAdBreaksBefore(position: number): YSAdBreak[] {
    return this.adParts
      .filter(part => part.start < position && position >= part.end)
      .map(element => element.adBreak);
  }

  private getAdDuration(ad: YSAdvert): number {
    return toSeconds(ad.getDuration());
  }

  private getAdStartTime(ad: YSAdvert): number {
    if (this.isLive()) {
      return this.adStartedTimestamp || 0;
    }

    return toSeconds(ad.getStart());
  }

  private toMagicTime(playbackTime: number): number {
    if (this.isLive()) return playbackTime;
    if (!this.session) return playbackTime;

    /**
     * Provides a relative content playhead position to the client,
     * discounting the sum of all ad break durations prior to the
     * absolute playhead position provided. This allows the client
     * to return to the same content position if a VOD stream is
     * stopped before playback ends.
     */
    return toSeconds(
      this.session.getContentPositionForPlayhead(
        toMilliseconds(playbackTime),
      ),
    );
  }

  private toAbsoluteTime(relativeTime: number): number {
    if (this.yospaceSourceConfig.assetType === YospaceAssetType.VOD) {
      if (!this.session) return relativeTime;

      /**
       * Provides an absolute playhead position to the client
       * calculating the sum of all ad break durations prior to
       * that absolute playhead position plus the relative content
       * playhead position. This allows the client to return to
       * the same content position if a VOD stream is stopped
       * before playback ends.
       */
      return toSeconds(
        this.session.getPlayheadForContentPosition(
          toMilliseconds(relativeTime),
        ),
      );
    } else {
      return relativeTime;
    }
  }

  private magicBufferLevel(bufferLevel: BufferLevel): number {
    if (this.isAdActive()) {
      return Math.min(bufferLevel.level, this.getCurrentAdDuration());
    }

    let futureBreakDurations = 0;
    const currentPlayerTime = this.player.getCurrentTime();
    const bufferedRange = currentPlayerTime + bufferLevel.level;

    this.adParts.map((part: StreamPart) => {
      if (part.start > currentPlayerTime && part.end < bufferedRange) {
        futureBreakDurations += part.end - part.start;
      } else if (part.start > currentPlayerTime && part.start < bufferedRange && part.end > bufferedRange) {
        futureBreakDurations += bufferedRange - part.start;
      }
    });

    return Math.max(bufferLevel.level - futureBreakDurations, 0);
  }

  private resetState(): void {
    // reset all local attributes
    this.unregisterPlayerEvents();
    if (this.session) {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.END');
      this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.STOP);
      this.session.shutdown();
      this.session = null;
    }

    if (this.dateRangeEmitter) {
      this.dateRangeEmitter.reset();
    }

    this.adParts = [];
    this.adStartedTimestamp = null;
    this.cachedSeekTarget = null;
    this.truexAdFree = undefined;
    this.startSent = false;
  }

  private handleQuartileEvent(adQuartileEventName: string): void {
    const playerEvent: AdQuartileEvent = {
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.AdQuartile,
      quartile: this.mapAdQuartile(adQuartileEventName),
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

  private parseId3Tags(event: MetadataEvent): YospaceAdManagement['TimedMetadata'] {
    const charsToStr = (arr: [number]) => {
      return arr.filter(char => char > 31 && char < 127).map(char => String.fromCharCode(char)).join('');
    };

    const metadata = event.metadata as any;
    const yospaceMetadataObject: any = {
      startTime: event.start ? event.start : this.player.getCurrentTime(),
    };

    metadata.frames.forEach((frame: any) => {
      yospaceMetadataObject[frame.key] = charsToStr(frame.data);
    });

    return YospaceAdManagement.TimedMetadata.createFromMetadata(
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

  private mapEmsgToId3Tags(event: MetadataEvent): YospaceAdManagement['TimedMetadata'] {
    const metadata = event.metadata as any;
    const yospaceMetadataObject: any = {
      startTime: metadata.presentationTime ? metadata.presentationTime : this.player.getCurrentTime(),
    };

    const messageData: string = metadata.messageData;
    messageData.split(',').forEach((metadata: string) => {
      let tags = metadata.split('=');
      yospaceMetadataObject[tags[0]] = tags[1];
    });

    return YospaceAdManagement.TimedMetadata.createFromMetadata(
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

  // Custom advertising module with overwritten methods
  private advertisingApi: PlayerAdvertisingAPI = {
    discardAdBreak: (adBreakId: string) => {
      Logger.warn('CSAI is not supported for yospace stream');
      return;
    },

    getActiveAdBreak: () => {
      if (!this.isAdActive()) {
        return undefined;
      }

      return this.mapAdBreak(this.getCurrentAdBreak());
    },

    getActiveAd: () => {
      if (!this.isAdActive()) {
        return undefined;
      }

      return AdTranslator.mapYsAdvert(this.getCurrentAd());
    },

    isLinearAdActive: () => {
      return this.isAdActive();
    },

    list: () => {
      if (!this.session) {
        return [];
      }

      return this.session.getAdBreaksByType(YospaceAdManagement.BreakType.LINEAR)
        .map((adBreak: YSAdBreak) => this.mapAdBreak(adBreak));
    },

    schedule: (adConfig: AdConfig) => {
      return Promise.reject('CSAI is not supported for yospace stream');
    },

    skip: () => {
      if (this.isAdActive()) {
        if (this.playerPolicy.canSkip() === 0) {
          const ad = this.getCurrentAd();
          const adBreak = this.getCurrentAdBreak();
          const seekTarget = this.getAdStartTime(ad) + this.getAdDuration(ad);

          if (seekTarget >= this.player.getDuration()) {
            this.isPlaybackFinished = true;
            this.suppressedEventsController.add(this.player.exports.PlayerEvent.Paused,
              this.player.exports.PlayerEvent.Seek, this.player.exports.PlayerEvent.Seeked);
            this.player.pause();
            this.player.seek((toSeconds(adBreak.getStart())) - 1); // -1 to be sure to don't have a frame of the ad visible
            this.fireEvent({
              timestamp: Date.now(),
              type: this.player.exports.PlayerEvent.PlaybackFinished,
            });
          } else {
            this.player.seek(seekTarget, 'ad-skip');
          }

          this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.ADVERT_SKIP);

          this.fireEvent({
            timestamp: Date.now(),
            type: this.player.exports.PlayerEvent.AdSkipped,
            ad: AdTranslator.mapYsAdvert(ad),
          } as AdEvent);
        } else {
          this.handleYospacePolicyEvent(YospacePolicyErrorCode.SKIP_NOT_ALLOWED);
        }
      }
    },

    getModuleInfo: () => {
      const moduleInfo = this.player.ads.getModuleInfo();
      moduleInfo.name += '-yospace-integration';
      return moduleInfo;
    },
  };

  private registerPlayerEvents(): void {
    this.player.on(this.player.exports.PlayerEvent.ModuleReady, this.onModuleReady);
    this.player.on(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.on(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.on(this.player.exports.PlayerEvent.Seeked, this.onSeeked);

    this.player.on(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.on(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    // To support ads in live streams we need to track metadata events
    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetaData);
  }

  private unregisterPlayerEvents(): void {
    this.player.off(this.player.exports.PlayerEvent.ModuleReady, this.onModuleReady);
    this.player.off(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.off(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.off(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.off(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.off(this.player.exports.PlayerEvent.Seeked, this.onSeeked);
    this.player.off(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.off(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    // To support ads in live streams we need to track metadata events
    this.player.off(this.player.exports.PlayerEvent.Metadata, this.onMetaData);
  }

  private onModuleReady = (event: ModuleReadyEvent) => {};

  private onPlaying = () => {
    if (!this.startSent) {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.START');
      this.startSent = true;
      this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.START);
    } else {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.RESUME');
      this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.RESUME);
    }
  };

  private onTimeChanged = (event: TimeChangedEvent) => {
    this.lastTimeChangedTime = event.time;

    // There is an outstanding bug on Safari mobile where upon exiting an ad break,
    // our TimeChanged event "rewinds" ~12 ms. This is a temporary fix.
    // If we report this "rewind" to Yospace, it results in duplicate ad events.
    const timeDifference = event.time - this.lastTimeChangedTime;
    if (timeDifference >= 0 || timeDifference < -0.25) {
      this.session.onPlayheadUpdate(toMilliseconds(event.time));
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

  private onPause = (event: PlaybackEvent) => {
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.PAUSE');
    this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.PAUSE);

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Paused)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Paused);
    }
  };

  private onSeek = (event: SeekEvent) => {
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.SEEK_START');

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seek)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seek);
    }
  };

  private onSeeked = (event: SeekEvent) => {
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.SEEK_END');
    this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.SEEK, toMilliseconds(this.player.getCurrentTime()));

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seeked)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seeked);
    }
  };

  private onStallStarted = (event: SeekEvent) => {
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.STALL');
    this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.STALL, toMilliseconds(this.player.getCurrentTime()));
  };

  private onStallEnded = (event: SeekEvent) => {
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.CONTINUE');
    this.session.onPlayerEvent(YospaceAdManagement.PlayerEvent.CONTINUE, toMilliseconds(this.player.getCurrentTime()));
  };

  private onMetaData = (event: MetadataEvent) => {
    const validTypes = ['ID3', 'EMSG', 'DATERANGE'];
    const type = event.metadataType;

    if (!validTypes.includes(type) || !this.player.isLive()) {
      return;
    }

    let yospaceMetadataObject: YospaceAdManagement['TimedMetadata'];
    if (type === 'ID3') {
      yospaceMetadataObject = this.parseId3Tags(event);
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.METADATA ' + stringify(yospaceMetadataObject));
      this.session.onTimedMetadata(yospaceMetadataObject);
    } else if (type === 'EMSG') {
      yospaceMetadataObject = this.mapEmsgToId3Tags(event);
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.METADATA ' + stringify(yospaceMetadataObject));
      this.session.onTimedMetadata(yospaceMetadataObject);
    }
  };

  private calculateAdParts() {
    this.adParts = this.session.getAdBreaksByType(YospaceAdManagement.BreakType.LINEAR).map((adBreak) => ({
      start: toSeconds(adBreak.getStart()),
      end: toSeconds(adBreak.getStart()) + toSeconds(adBreak.getDuration()),
      adBreak: adBreak,
    }));
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
        (this as any)[method] = function() {
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
        const propertyDescriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(this.player, property) ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.player), property);

        // If the property has getters/setters, wrap them accordingly...
        if (propertyDescriptor && (propertyDescriptor.get || propertyDescriptor.set)) {
          Object.defineProperty((this as any), property, {
            get: () => propertyDescriptor.get.call(this.player),
            set: (value: any) => propertyDescriptor.set.call(this.player, value),
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
  static mapYsAdvert(ysAd: YSAdvert): LinearAd {

    if (!ysAd || ysAd.isNonLinear()) {
      return null;
    }

    const extensions: VastAdExtension = ysAd.getExtensions();
    const lineage: YospaceAdManagement['AdvertWrapper'] = ysAd.getLineage();

    return {
      isLinear: !ysAd.isNonLinear(),
      duration: toSeconds(ysAd.getDuration()),
      id: ysAd.getIdentifier(),
      creativeId: ysAd.getLinearCreative().getCreativeIdentifier(),
      adTitle: ysAd.getProperty('AdTitle')?.value,
      advertiser: ysAd.getProperty('Advertiser')?.value,
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
      extensions: extensions ? [extensions] : [],
      adSystem: ysAd.getProperty('AdSystem')?.value,
      sequence: ysAd.getSequence(),
      isFiller: ysAd.isFiller(),
    } as YospaceLinearAd;
  }
}

class AdEventsFactory {
  static createAdBreakEvent(
    type: PlayerEvent,
    adBreak: YospaceAdBreak,
  ): YospaceAdBreakEvent {
    return {
      timestamp: Date.now(),
      type: type,
      adBreak: adBreak,
    };
  }

  static createAdEvent(
    player: PlayerAPI,
    type: PlayerEvent,
    ad: YSAdvert,
    companionAds?: CompanionAd[],
  ): AdEvent {
    return {
      timestamp: Date.now(),
      type: type,
      ad: {
        clickThroughUrlOpened: () => {
          Logger.log('[BitmovinYospacePlayer] - triggering click through on ad. ');
          ad.getLinearCreative()?.onClickThrough();
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
    for (let item of items) {
      if (!this.isSuppressed(item)) {
        this.suppressedEvents.push(item);
      }
    }
  }

  remove(...items: PlayerEvent[]) {
    for (let item of items) {
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
