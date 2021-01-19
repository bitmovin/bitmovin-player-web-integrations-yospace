///<reference path='Yospace.d.ts'/>
///<reference path="VAST.d.ts"/>

import {
  AdBreakEvent, AdEvent, AdQuartile, AdQuartileEvent, BufferLevel, BufferType, ErrorEvent, MediaType, MetadataEvent,
  PlaybackEvent, PlayerAPI, PlayerBufferAPI, PlayerError, PlayerEvent, PlayerEventBase, PlayerEventCallback, SeekEvent,
  TimeChangedEvent, TimeRange,
} from 'bitmovin-player/modules/bitmovinplayer-core';

import {
  BYSAdBreakEvent, BYSAdEvent, BYSAnalyticsFiredEvent, BYSListenerEvent, YospaceAdListenerAdapter,
} from './YospaceListenerAdapter';
import { DefaultBitmovinYospacePlayerPolicy } from './BitmovinYospacePlayerPolicy';
import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';
import { VastHelper } from './VastHelper';
import {
  BitmovinYospacePlayerAPI, BitmovinYospacePlayerPolicy, UNDEFINED_VAST_ERROR_CODE, YospaceAdBreak, YospaceAdBreakEvent,
  YospaceAssetType, YospaceCompanionAd, YospaceConfiguration, YospaceErrorCode, YospaceErrorEvent, YospaceEventBase,
  YospacePlayerEvent, YospacePlayerEventCallback, YospacePolicyErrorCode, YospacePolicyErrorEvent, YospaceSourceConfig, YospaceAdBreakPosition,
} from './BitmovinYospacePlayerAPI';
import { YospacePlayerError } from './YospaceError';
import {
  AdConfig, CompanionAd, LinearAd, PlayerAdvertisingAPI,
} from 'bitmovin-player/modules/bitmovinplayer-advertising-core';
import { Logger } from './Logger';
import { DateRangeEmitter } from './DateRangeEmitter';
import { BitmovinYospaceHelper } from './BitmovinYospaceHelper';
import stringify from 'fast-safe-stringify';

interface StreamPart {
  start: number;
  end: number;
  adBreak?: YSAdBreak;
}

interface StreamPartMapping {
  magic: StreamPart;
  original: StreamPart;
}

// TODO: remove this when it's available in the Player
export interface YospaceLinearAd extends LinearAd {
  extensions: any[];
  adSystem?: string;
  companionAds?: CompanionAd[];
  sequence: number;
  creativeId: string;
}

// Enums for yospace related vpaid ad tracking strings
enum VpaidTrackingEvent {
  AdSkipped = 'skip',
  AdStarted = 'creativeView',
  AdVideoStart = 'start',
  AdVideoFirstQuartile = 'firstQuartile',
  AdVideoMidpoint = 'midpoint',
  AdVideoThirdQuartile = 'thirdQuartile',
  AdVideoComplete = 'complete',
  AdPaused = 'pause',
  AdPlaying = 'resume',

  // Unused as not supported by our player
  AdUserAcceptInvitation = 'acceptInvitation',
  AdUserMinimize = 'collapse',
  AdUserClose = 'close',
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
  private _manager: YSSessionManager;
  private yospaceListenerAdapter: YospaceAdListenerAdapter;
  private playerPolicy: BitmovinYospacePlayerPolicy;

  // magic content duration handling
  private contentDuration: number = 0;
  private contentMapping: StreamPartMapping[] = [];
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

  // save vpaid status
  private isVpaidActive = false;

  // state when returning from vpaid
  private isReturningVpaid = false;

  // convert EXT-X-DATERANGE tags to EMSG events
  private dateRangeEmitter: DateRangeEmitter;

  // save the last VPAID ad
  private lastVPaidAd: YSAdvert;

  // save the truexAdFree state
  private truexAdFree: boolean;

  // VASTParser used for parsing companion ads
  private vastParser: VAST.VASTParser = new VAST.VASTParser();

  private startSent: boolean;

  // When exiting a VPAID, player.isLive() returns false, so we store the value on stream start
  private isLiveStream: boolean;

  private lastTimeChangedTime: number;

  constructor(containerElement: HTMLElement, player: PlayerAPI, yospaceConfig: YospaceConfiguration = {}) {
    this.yospaceConfig = yospaceConfig;
    Logger.log('[BitmovinYospacePlayer] loading YospacePlayer with config= ' + stringify(this.yospaceConfig));
    if (!this.yospaceConfig.liveVpaidDurationAdjustment) {
      this.yospaceConfig.liveVpaidDurationAdjustment = 2;
    }

    this.player = player;

    if (BitmovinYospaceHelper.isSafari() || BitmovinYospaceHelper.isSafariIOS()) {
      this.dateRangeEmitter = new DateRangeEmitter(this.player, this.eventHandlers);
    }

    if (this.yospaceConfig.breakTolerance) {
      Logger.log('[BitmovinYospacePlayer] setting YSSession.BREAK_TOLERANCE to ' + this.yospaceConfig.breakTolerance);
      YSSession.BREAK_TOLERANCE = this.yospaceConfig.breakTolerance;
    }

    this.wrapPlayer();
  }

  get manager(): YSSessionManager {
    return this._manager;
  }

  set manager(value: YSSessionManager) {
    this._manager = value;
    if (this.dateRangeEmitter) {
      this.dateRangeEmitter.manager = this._manager;
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
      const onInitComplete = (result: YSSessionResult, state: YSSessionStatus) => {
        const getYospaceError = (result: YSSessionResult, state: YSSessionStatus): YospacePlayerError => {
          let errorCode: YospaceErrorCode;
          let detailedErrorCode: YospaceErrorCode;
          let detailedErrorMessage: string;

          // Detect general error
          if (result === YSSessionResult.NO_ANALYTICS) {
            errorCode = YospaceErrorCode.NO_ANALYTICS;
          } else if (result === YSSessionResult.NOT_INITIALISED) {
            errorCode = YospaceErrorCode.NOT_INITIALISED;
          }

          // Collect error details
          switch (state) {
            case YSSessionStatus.CONNECTION_ERROR:
              detailedErrorCode = YospaceErrorCode.CONNECTION_ERROR;
              break;
            case YSSessionStatus.CONNECTION_TIMEOUT:
              detailedErrorCode = YospaceErrorCode.CONNECTION_TIMEOUT;
              break;
            case YSSessionStatus.MALFORMED_URL:
              detailedErrorCode = YospaceErrorCode.MALFORMED_URL;
              break;
            case YSSessionStatus.NO_LIVEPAUSE:
              detailedErrorCode = YospaceErrorCode.NO_LIVEPAUSE;
              break;
            case YSSessionStatus.NON_YOSPACE_URL:
              detailedErrorCode = YospaceErrorCode.NON_YOSPACE_URL;
              break;
            default:
              // if the result is an number and greater than 0 it represents the http status code
              detailedErrorMessage = state > 0 ? `HTTP status code ${state}` : undefined;
              detailedErrorCode = YospaceErrorCode.UNKNOWN_ERROR;
          }

          return new YospacePlayerError(errorCode, {
            errorCode: detailedErrorCode,
            errorMessage: detailedErrorMessage || `${errorCode}/${YospaceErrorCode[detailedErrorCode]}`,
          });
        };

        if (result === YSSessionResult.INITIALISED) {
          this.calculateAdParts();
          // clone source to not modify passed object
          let clonedSource = {
            ...source,
            hls: this.manager.masterPlaylist(), // use received url from yospace
          };

          // convert start time (relative) to an absolute time
          if (this.yospaceSourceConfig.assetType === YospaceAssetType.VOD && clonedSource.options
            && clonedSource.options.startOffset) {
            clonedSource.options.startOffset = this.toAbsoluteTime(clonedSource.options.startOffset);
            Logger.log('startOffset adjusted to: ' + clonedSource.options.startOffset);
          }

          this.yospaceListenerAdapter = new YospaceAdListenerAdapter();
          this.bindYospaceEvent();
          this.manager.registerPlayer(this.yospaceListenerAdapter);

          // Initialize policy
          if (!this.playerPolicy) {
            this.playerPolicy = new DefaultBitmovinYospacePlayerPolicy(this as any as BitmovinYospacePlayerAPI);
          }

          Logger.log('Loading Source: ' + stringify(clonedSource));
          this.player.load(clonedSource, forceTechnology, disableSeeking).then(resolve).catch(reject);
        } else {
          this.manager.shutdown();
          this.manager = null;

          this.handleYospaceError(getYospaceError(result, state));
          reject();
        }
      };

      const properties: YSSessionManagerDefault = {
        ...YSSessionManager.DEFAULTS,
        DEBUGGING: Boolean(this.yospaceConfig.debug),
        USE_ID3: source.assetType !== YospaceAssetType.VOD, // Use time based tracking only for VOD
      };

      if (!this.yospaceConfig.disableStrictBreaks && source.assetType === YospaceAssetType.LINEAR) {
        Logger.log('[BitmovinYospacePlayer] enabling strict_breaks through Yospace SDK');
        properties.STRICT_BREAKS = true;
      }

      YSParseUtils.NAMESPACES = true;

      switch (source.assetType) {
        case YospaceAssetType.LINEAR:
          this.manager = YSSessionManager.createForLive(url, properties, onInitComplete);
          break;
        case YospaceAssetType.VOD:
          this.manager = YSSessionManager.createForVoD(url, properties, onInitComplete);
          break;
        case YospaceAssetType.LINEAR_START_OVER:
          this.manager = YSSessionManager.createForNonLinear(url, properties, onInitComplete);
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

    if (this.isAdActive() && this.player.isPaused()) {
      // track ad resumed
      this.getCurrentAd().adResumed();
    }
    return this.player.play(issuer);
  }

  pause(issuer?: string): void {
    if (this.playerPolicy.canPause()) {
      if (this.isAdActive() && this.player.isPlaying()) {
        // track ad paused
        this.getCurrentAd().adPaused();
      }
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
    // Do not calculate magic time in case of Vpaid
    if (this.isVpaidActive) {
      return this.player.getCurrentTime();
    }

    if (this.isAdActive()) {
      // return currentTime in AdBreak
      const currentAdPosition = this.player.getCurrentTime();
      return currentAdPosition - this.getAdStartTime(this.getCurrentAd());
    }

    return this.toMagicTime(this.player.getCurrentTime());
  }

  getDuration(): number {
    // Do not calculate magic time in case of Vpaid
    if (this.isVpaidActive) {
      return this.player.getDuration();
    }

    if (this.isAdActive()) {
      return this.getCurrentAd().duration;
    }

    if (this.isLive()) {
      return this.player.getDuration();
    }

    // return magic content duration
    return this.contentDuration;
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
      const adEnd = adStart + currentAd.duration;

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
          const sumOfAdBreakDurations = diff.reduce((sum, adBreak) => sum + adBreak.getDuration(), 0);
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

  private getCurrentAd(): YSAdvert | null {
    if (!this.manager) {
      return null;
    }
    return this.manager.session.currentAdvert;
  }

  private getCurrentAdBreak(): YSAdBreak | null {
    if (!this.manager) {
      return null;
    }
    return this.manager.session.getCurrentBreak();
  }

  getYospaceManager(): YSSessionManager | null {
    return this.manager;
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

    const adBreak = event.adBreak;
    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player,
      adBreak.adBreakIdentifier,
      this.toMagicTime(adBreak.startPosition),
      this.player.exports.PlayerEvent.AdBreakStarted,
      adBreak.getDuration(),
      adBreak.getPosition(),
    );
    this.fireEvent<YospaceAdBreakEvent>(playerEvent);
  };

  private onAdStarted = (event: BYSAdEvent) => {
    const currentAd = this.getCurrentAd();

    if (currentAd && currentAd.advert && currentAd.advert.vastXML && currentAd.advert.vastXML.outerHTML) {
      Logger.log(this.vastParser);
      this.vastParser.parseVAST(VastHelper.buildVastDocument(currentAd.advert), {})
        .then((vastResponse: VAST.VastResponse) => {
          this.handleAdStart(currentAd, VastHelper.parseVastResponse(vastResponse));
        }).catch((err: any) => {
        Logger.log('[BitmovinYospacePlayer] Unable to parse vastXML. No companion ad found - ' + err);
        this.handleAdStart(currentAd);
      });
    } else {
      Logger.log('[BitmovinYospacePlayer] Unable to parse vastXML. No VAST XML present');
      this.handleAdStart(currentAd);
    }
  };

  private handleAdStart = (currentAd: YSAdvert, yospaceCompanionAds?: YospaceCompanionAd[]) => {
    let isTruexAd = currentAd.advert.AdSystem === 'trueX';

    // Display all VPAID ads & Truex ads if a TruexConfiguration is present
    if (!this.yospaceConfig.disableVpaidRenderer && currentAd.hasInteractiveUnit() && (!isTruexAd
      || this.yospaceSourceConfig.truexConfiguration)) {
      this.isVpaidActive = true;
      Logger.log('[BitmovinYospacePlayer] suppressing Yospace analytics');
      this.manager.session.suppressAnalytics(true);
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.PAUSE at start of VPAID');
      this.manager.reportPlayerEvent(YSPlayerEvents.PAUSE, this.player.getCurrentTime());
      let position = String(this.player.getCurrentTime());
      let replaceContentDuration = currentAd.duration;

      // workaround for back to back VPAIDs on live
      if (this.isLive() && this.yospaceConfig.liveVpaidDurationAdjustment) {
        replaceContentDuration = replaceContentDuration - this.yospaceConfig.liveVpaidDurationAdjustment;
        Logger.log('[BitmovinYospacePlayer] Adjusting replace content duration by '
          + this.yospaceConfig.liveVpaidDurationAdjustment + ' - ' + replaceContentDuration);
      }

      // If we are scheduling a VPAID for Truex, do not add a replaceContentDuration,
      // as we seek over the ad break when appropriate in TUB
      if (!this.isLive() && isTruexAd) {
        replaceContentDuration = 0;
      }

      Logger.log(
        '[BitmovinYospacePlayer] Schedule VPAID: ' + currentAd.advert.id + ' truex: ' + isTruexAd + ' replaceDuration='
        + replaceContentDuration + ' position=' + position + ' seekable.start=' + this.player.getSeekableRange().start
        + ' seekable.end=' + this.player.getSeekableRange().end);
      Logger.log(VastHelper.buildDataUriWithoutTracking(currentAd.advert));

      this.player.ads.schedule({
        tag: {
          url: VastHelper.buildDataUriWithoutTracking(currentAd.advert),
          type: 'vast',
        },
        position: position,
        replaceContentDuration: replaceContentDuration,
      } as AdConfig).catch((reason: string) => {
        const error = new PlayerError(this.player.exports.ErrorCode.MODULE_ADVERTISING_ERROR, {
          code: UNDEFINED_VAST_ERROR_CODE,
          message: reason,
        });

        this.fireEvent<ErrorEvent>({
          timestamp: Date.now(),
          type: this.player.exports.PlayerEvent.AdError,
          code: error.code,
          name: error.message,
          data: error.data,
        });
      });
    } else if (isTruexAd && !this.yospaceSourceConfig.truexConfiguration) {
      Logger.warn('TrueX ad not rendered because a truexConfiguration was not specified');
    }

    const playerEvent = AdEventsFactory.createAdEvent(
      this.player,
      this.player.exports.PlayerEvent.AdStarted,
      this.manager,
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

  private onAdFinished = (event: BYSAdEvent) => {
    const playerEvent = AdEventsFactory.createAdEvent(
      this.player,
      this.player.exports.PlayerEvent.AdFinished,
      this.manager,
      this.getCurrentAd(),
    );
    this.fireEvent<AdEvent>(playerEvent);
    this.adStartedTimestamp = null;
  };

  private onAdBreakFinished = (event: BYSAdBreakEvent) => {
    const adBreak = event.adBreak;
    const playerEvent = AdEventsFactory.createAdBreakEvent(
      this.player,
      adBreak.adBreakIdentifier,
      this.toMagicTime(adBreak.startPosition),
      this.player.exports.PlayerEvent.AdBreakFinished,
      adBreak.getDuration(),
      adBreak.getPosition(),
    );

    this.fireEvent<YospaceAdBreakEvent>(playerEvent);

    if (this.cachedSeekTarget) {
      this.seek(this.cachedSeekTarget, 'yospace-ad-skipping');
      this.cachedSeekTarget = null;
    }

    this.player.setPlaybackSpeed(this.playbackSpeed);
  };

  private onAnalyticsFired = (event: BYSAnalyticsFiredEvent) => {
    const isQuartileEvent = (eventName: string) => {
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
      id: ysAdBreak.adBreakIdentifier, // can be null
      scheduleTime: this.toMagicTime(ysAdBreak.startPosition),
      ads: ysAdBreak.adverts.map(AdTranslator.mapYsAdvert),
      duration: ysAdBreak.getDuration(),
      position: ysAdBreak.getPosition() as YospaceAdBreakPosition
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

  private getAdStartTime(ad: YSAdvert): number {
    if (this.isLive()) {
      return this.adStartedTimestamp || 0;
    }

    const indexInAdBreak = ad.adBreak.adverts.indexOf(ad);
    const previousAdverts: YSAdvert[] = ad.adBreak.adverts.slice(0, indexInAdBreak);

    return ad.adBreak.startPosition + previousAdverts.reduce((sum, advert) => sum + advert.duration, 0);
  }

  private toMagicTime(playbackTime: number): number {
    const previousBreaksDuration = this.getAdBreaksBefore(playbackTime)
      .reduce((sum, adBreak) => sum + adBreak.getDuration(), 0);

    return playbackTime - previousBreaksDuration;
  }

  private toAbsoluteTime(relativeTime: number): number {
    const originalStreamPart = this.contentMapping.find((mapping: StreamPartMapping) => {
      return mapping.magic.start <= relativeTime && relativeTime <= mapping.magic.end;
    });

    if (originalStreamPart) {
      const elapsedTimeInStreamPart = relativeTime - originalStreamPart.magic.start;
      const absoluteTime = originalStreamPart.original.start + elapsedTimeInStreamPart;
      return absoluteTime;
    } else {
      return relativeTime;
    }
  }

  private magicBufferLevel(bufferLevel: BufferLevel): number {
    if (this.isAdActive()) {
      return Math.min(bufferLevel.level, this.getCurrentAd().duration);
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
    if (this.manager) {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.END');
      this.manager.reportPlayerEvent(YSPlayerEvents.END);
      this.manager.shutdown();
      this.manager = null;
    }

    if (this.dateRangeEmitter) {
      this.dateRangeEmitter.reset();
    }

    this.lastVPaidAd = null;
    this.contentDuration = 0;
    this.contentMapping = [];
    this.adParts = [];
    this.adStartedTimestamp = null;
    this.cachedSeekTarget = null;
    this.isVpaidActive = false;
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

  private parseId3Tags(event: MetadataEvent): Object {
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

    return yospaceMetadataObject;
  }

  private mapEmsgToId3Tags(event: MetadataEvent): Object {
    const metadata = event.metadata as any;
    const yospaceMetadataObject: any = {
      startTime: metadata.presentationTime ? metadata.presentationTime : this.player.getCurrentTime(),
    };

    const messageData: string = metadata.messageData;
    messageData.split(',').forEach((metadata: string) => {
      let tags = metadata.split('=');
      yospaceMetadataObject[tags[0]] = tags[1];
    });

    return yospaceMetadataObject;
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
      if (!this.manager) {
        return [];
      }

      return this.manager.session.timeline.getAllElements()
        .filter((element: YSTimelineElement) => element.type === YSTimelineElement.ADVERT)
        .map((element: YSTimelineElement) => this.mapAdBreak(element.adBreak));
    },

    schedule: (adConfig: AdConfig) => {
      return Promise.reject('CSAI is not supported for yospace stream');
    },

    skip: () => {
      if (this.isAdActive()) {
        if (this.playerPolicy.canSkip() === 0) {
          const ad = this.getCurrentAd();
          const seekTarget = this.getAdStartTime(ad) + ad.duration;

          if (seekTarget >= this.player.getDuration()) {
            this.isPlaybackFinished = true;
            this.suppressedEventsController.add(this.player.exports.PlayerEvent.Paused,
              this.player.exports.PlayerEvent.Seek, this.player.exports.PlayerEvent.Seeked);
            this.player.pause();
            this.player.seek(ad.adBreak.startPosition - 1); // -1 to be sure to don't have a frame of the ad visible
            this.fireEvent({
              timestamp: Date.now(),
              type: this.player.exports.PlayerEvent.PlaybackFinished,
            });
          } else {
            this.player.seek(seekTarget, 'ad-skip');
          }

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
    this.player.on(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.on(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.on(this.player.exports.PlayerEvent.Seeked, this.onSeeked);

    this.player.on(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.on(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    // To support ads in live streams we need to track metadata events
    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetaData);

    // Subscribe to some ad events. In Case of VPAID we rely on the player events to track it.
    this.player.on(this.player.exports.PlayerEvent.AdBreakStarted, this.onVpaidAdBreakStarted);
    this.player.on(this.player.exports.PlayerEvent.AdBreakFinished, this.onVpaidAdBreakFinished);
    this.player.on(this.player.exports.PlayerEvent.AdStarted, this.onVpaidAdStarted);
    this.player.on(this.player.exports.PlayerEvent.AdFinished, this.onVpaidAdFinished);
    this.player.on(this.player.exports.PlayerEvent.AdSkipped, this.onVpaidAdSkipped);
    this.player.on(this.player.exports.PlayerEvent.AdQuartile, this.onVpaidAdQuartile);
    this.player.on(this.player.exports.PlayerEvent.AdError, this.onVpaidAdError);

  }

  private unregisterPlayerEvents(): void {
    this.player.off(this.player.exports.PlayerEvent.Playing, this.onPlaying);
    this.player.off(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.off(this.player.exports.PlayerEvent.Paused, this.onPause);
    this.player.off(this.player.exports.PlayerEvent.Seek, this.onSeek);
    this.player.off(this.player.exports.PlayerEvent.Seeked, this.onSeeked);
    this.player.off(this.player.exports.PlayerEvent.StallStarted, this.onStallStarted);
    this.player.off(this.player.exports.PlayerEvent.StallEnded, this.onStallEnded);

    // To support ads in live streams we need to track metadata events
    this.player.off(this.player.exports.PlayerEvent.Metadata, this.onMetaData);

    // Subscribe to some ad events. In Case of VPAID we rely on the player events to track it.
    this.player.off(this.player.exports.PlayerEvent.AdBreakStarted, this.onVpaidAdBreakStarted);
    this.player.off(this.player.exports.PlayerEvent.AdBreakFinished, this.onVpaidAdBreakFinished);
    this.player.off(this.player.exports.PlayerEvent.AdStarted, this.onVpaidAdStarted);
    this.player.off(this.player.exports.PlayerEvent.AdFinished, this.onVpaidAdFinished);
    this.player.off(this.player.exports.PlayerEvent.AdSkipped, this.onVpaidAdSkipped);
    this.player.off(this.player.exports.PlayerEvent.AdQuartile, this.onVpaidAdQuartile);
  }

  private onPlaying = () => {
    if (this.isVpaidActive) {
      this.trackVpaidEvent(VpaidTrackingEvent.AdPlaying);
      return;
    }

    if (!this.startSent) {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.START');
      this.startSent = true;
      this.manager.reportPlayerEvent(YSPlayerEvents.START);
    } else {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvent.RESUME');
      this.manager.reportPlayerEvent(YSPlayerEvents.RESUME);

    }

    this.isLiveStream = this.player.isLive();
  };

  private onTimeChanged = (event: TimeChangedEvent) => {
    if (!this.isVpaidActive) {
      // There is an outstanding bug on Safari mobile where upon exiting an ad break, 
      // our TimeChanged event "rewinds" ~12 ms. This is a temporary fix. 
      // If we report this "rewind" to Yospace, it results in duplicate ad events.
      const timeDifference = event.time - this.lastTimeChangedTime;
      if (timeDifference > 0 || timeDifference < -0.25) {
        this.manager.reportPlayerEvent(YSPlayerEvents.POSITION, event.time);
      } else {
        Logger.warn('Encountered a small negative TimeChanged update, not reporting to Yospace. Difference was: ' + timeDifference);
      }
    }
    this.lastTimeChangedTime = event.time;

    if (this.isReturningVpaid) {
      Logger.log('[BitmovinYospacePlayer] sending YSPlayerEvents.CONTINUE to resume from VPAID ad');
      this.manager.reportPlayerEvent(YSPlayerEvents.CONTINUE, event.time);
      this.isReturningVpaid = false;
    }

    // fire magic time-changed event
    this.fireEvent<TimeChangedEvent>({
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.TimeChanged,
      time: this.getCurrentTime(),
    });
  };

  private onPause = (event: PlaybackEvent) => {
    if (this.isVpaidActive) {
      this.trackVpaidEvent(VpaidTrackingEvent.AdPaused);
    } else {
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.PAUSE');
      this.manager.reportPlayerEvent(YSPlayerEvents.PAUSE);
    }

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Paused)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Paused);
    }
  };

  private onSeek = (event: SeekEvent) => {
    if (this.isVpaidActive) {
      return;
    }
    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.SEEK_START');
    this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_START, this.player.getCurrentTime());

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seek)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seek);
    }
  };

  private onSeeked = (event: SeekEvent) => {
    if (this.isVpaidActive) {
      return;
    }

    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.SEEK_END');
    this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_END, this.player.getCurrentTime());

    if (!this.suppressedEventsController.isSuppressed(this.player.exports.PlayerEvent.Seeked)) {
      this.fireEvent(event);
    } else {
      this.suppressedEventsController.remove(this.player.exports.PlayerEvent.Seeked);
    }
  };

  private onStallStarted = (event: SeekEvent) => {
    if (this.isVpaidActive) {
      return;
    }

    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.STALL');
    this.manager.reportPlayerEvent(YSPlayerEvents.STALL, this.player.getCurrentTime());
  };

  private onStallEnded = (event: SeekEvent) => {
    if (this.isVpaidActive) {
      return;
    }

    Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.CONTINUE');
    this.manager.reportPlayerEvent(YSPlayerEvents.CONTINUE, this.player.getCurrentTime());

  };

  private onMetaData = (event: MetadataEvent) => {
    if (this.isVpaidActive) {
      return;
    }

    const validTypes = ['ID3', 'EMSG', 'DATERANGE'];
    const type = event.metadataType;

    if (!validTypes.includes(type) || !this.player.isLive()) {
      return;
    }

    let yospaceMetadataObject: { [key: string]: any; };
    if (type === 'ID3') {
      yospaceMetadataObject = this.parseId3Tags(event);
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.METADATA ' + stringify(yospaceMetadataObject));
      this.manager.reportPlayerEvent(YSPlayerEvents.METADATA, yospaceMetadataObject);
    } else if (type === 'EMSG') {
      yospaceMetadataObject = this.mapEmsgToId3Tags(event);
      Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.METADATA ' + stringify(yospaceMetadataObject));
      this.manager.reportPlayerEvent(YSPlayerEvents.METADATA, yospaceMetadataObject);
    }
  };

  private onVpaidAdBreakStarted = (event: AdBreakEvent) => {
    this.trackVpaidEvent(VpaidTrackingEvent.AdStarted);
  };

  private onVpaidAdStarted = (event: AdEvent) => {
    const currentAd = this.getCurrentAd();
    this.lastVPaidAd = currentAd;
    this.trackVpaidEvent(VpaidTrackingEvent.AdVideoStart);
  };

  private onVpaidAdFinished = (event: AdEvent) => {
    // We have a guard statement in trackVpaidEvent so we need to track it before setting the
    // isVpaidActive flag to false.
    this.trackVpaidEvent(VpaidTrackingEvent.AdVideoComplete);
    this.cleanUpVpaidAd();
  };

  private onVpaidAdBreakFinished = (event: AdBreakEvent) => {
    const currentAd = this.lastVPaidAd;

    // if truexAdFree has not been set to false by the adskipped listener, fire the truexadfree event
    if (currentAd.advert.AdSystem === 'trueX' && this.truexAdFree !== false) {
      Logger.log('TrueXAdFree firing');
      this.fireEvent({
        timestamp: Date.now(),
        type: YospacePlayerEvent.TruexAdFree,
      });
    }

    this.lastVPaidAd = null;
    this.truexAdFree = undefined;
  };

  private onVpaidAdSkipped = (event: AdEvent) => {
    if (this.lastVPaidAd && this.lastVPaidAd.advert.AdSystem === 'trueX') {
      this.truexAdFree = false;
      Logger.log('Truex ad skipped: ' + this.lastVPaidAd.advert.id);
    }

    this.trackVpaidEvent(VpaidTrackingEvent.AdSkipped);

    Logger.log('[BitmovinYospacePlayer] firing VPAID adskipped event');
    this.fireEvent<AdEvent>({
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.AdSkipped,
      ad: AdTranslator.mapYsAdvert(this.lastVPaidAd),
    });

    this.cleanUpVpaidAd();
  };

  private onVpaidAdError = (event: AdEvent) => {
    Logger.log('[BitmovinYospacePlayer] VPAID Error occurred');

    if (this.lastVPaidAd && this.lastVPaidAd.advert && this.lastVPaidAd.advert.AdSystem === 'trueX') {
      this.truexAdFree = false;
      Logger.log('[BitmovinYospacePlayer] Truex ad errored: ' + this.lastVPaidAd.advert.id);
    }

    this.cleanUpVpaidAd();

    Logger.log('[BitmovinYospacePlayer] firing VPAID aderror event');
    this.fireEvent<AdEvent>({
      timestamp: Date.now(),
      type: this.player.exports.PlayerEvent.AdError,
      ad: AdTranslator.mapYsAdvert(this.lastVPaidAd),
    });
  };

  private cleanUpVpaidAd = () => {
    this.isVpaidActive = false;
    const currentAd = this.lastVPaidAd;
    const session = this.manager.session;

    Logger.log('[BitmovinYospacePlayer] - resuming Yospace analytics');
    this.manager.reportPlayerEvent(YSPlayerEvents.RESUME, this.player.getCurrentTime());
    try {
      if (this.isLiveStream) {
        Logger.log('[BitmovinYospacePlayer] - calling YSSession.handleAdvertEnd() id=' + currentAd.getMediaID());
        session.handleAdvertEnd(currentAd);
      }
    } catch {
      Logger.warn('[BitmovinYospacePlayer] exception thrown inside handleAdvertEnd');
    }
    Logger.log('[BitmovinYospacePlayer] - re-enabling Yospace analytics');
    session.suppressAnalytics(false);

    this.isReturningVpaid = true;
    Logger.log('[BitmovinYospacePlayer] - sending stall event while returning from VPAID');
    this.manager.reportPlayerEvent(YSPlayerEvents.STALL, this.player.getCurrentTime());
  };

  private onVpaidAdQuartile = (event: AdQuartileEvent) => {
    const mapAdQuartile = (quartileEvent: AdQuartileEvent): VpaidTrackingEvent => {
      switch (quartileEvent.quartile) {
        case this.player.exports.AdQuartile.FIRST_QUARTILE:
          return VpaidTrackingEvent.AdVideoFirstQuartile;
        case this.player.exports.AdQuartile.MIDPOINT:
          return VpaidTrackingEvent.AdVideoMidpoint;
        case this.player.exports.AdQuartile.THIRD_QUARTILE:
          return VpaidTrackingEvent.AdVideoThirdQuartile;
      }
    };

    this.trackVpaidEvent(mapAdQuartile(event));
    this.handleQuartileEvent(event.quartile);
  };

  private trackVpaidEvent(event: VpaidTrackingEvent) {
    if (!this.isVpaidActive) {
      return;
    }

    const currentAd = this.getCurrentAd();
    const currentBreak = currentAd.adBreak;
    Logger.log('[BitmovinYospacePlayer] tracking VPAID event ' + event + ' id=' + currentAd.getMediaID());
    currentAd.getInteractiveUnit().track(
      event,
      this.player.getCurrentTime(), // The VPAID ad needs to implement the VPAID API otherwise we will report 0 here
      '', // We don't know the asset url as the VPAID is loading this
      currentBreak.getDuration() + '', // Yospace want it as string
    );
  }

  private calculateAdParts() {
    if (this.yospaceSourceConfig.assetType === YospaceAssetType.VOD) {
      const session = this.manager.session;
      const timeline = session.timeline;
      // calculate duration magic
      timeline.getAllElements().forEach((element) => {
        const originalChunk: StreamPart = {
          start: element.offset,
          end: element.offset + element.duration,
        };

        switch (element.type) {
          case YSTimelineElement.ADVERT:
            originalChunk.adBreak = element.adBreak;

            this.adParts.push(originalChunk);
            break;
          case YSTimelineElement.VOD:

            const magicalContentChunk = {
              start: this.contentDuration,
              end: this.contentDuration + element.duration,
            };

            this.contentMapping.push({
              magic: magicalContentChunk,
              original: originalChunk,
            });

            this.contentDuration += element.duration;
            break;
        }
      });
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
    if (this.isAdActive() || this.lastVPaidAd) {
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
    const mediaFile = ysAd.advert.linear.mediaFiles[0];
    return {
      isLinear: Boolean(ysAd.advert.linear),
      duration: ysAd.duration,
      id: ysAd.getAdvertID(),
      creativeId: ysAd.getCreativeID(),
      adTitle: ysAd.advert.AdTitle,
      advertiser: ysAd.advert.Advertiser,
      lineage: ysAd.advert.AdvertLineage,
      height: mediaFile && mediaFile.height && parseInt(mediaFile.height),
      width: mediaFile && mediaFile.width && parseInt(mediaFile.width),
      clickThroughUrl: ysAd.advert.linear.clickThrough,
      mediaFileUrl: mediaFile && mediaFile.src,
      skippableAfter: ysAd.advert.linear.skipOffset,
      uiConfig: {
        requestsUi: !ysAd.hasInteractiveUnit(),
      },
      extensions: VastHelper.getExtensions(ysAd.advert),
      adSystem: ysAd.advert.AdSystem,
      sequence: ysAd.advert.sequence,
      isFiller: ysAd.isFiller()
    } as YospaceLinearAd;
  }
}

class AdEventsFactory {
  static createAdBreakEvent(
    player: PlayerAPI,
    adBreakId: string,
    scheduleTime: number,
    type: PlayerEvent,
    duration: number,
    position: string,
  ): YospaceAdBreakEvent {
    return {
      timestamp: Date.now(),
      type: type,
      adBreak: {
        id: adBreakId, // can be null
        scheduleTime: scheduleTime,
        duration: duration,
        position: position as YospaceAdBreakPosition,
      },
    };
  }

  static createAdEvent(
    player: PlayerAPI,
    type: PlayerEvent,
    manager: YSSessionManager,
    ad: YSAdvert,
    companionAds?: CompanionAd[],
  ): AdEvent {
    return {
      timestamp: Date.now(),
      type: type,
      ad: {
        clickThroughUrlOpened: () => {
          Logger.log('[BitmovinYospacePlayer] - sending YSPlayerEvents.Click ');
          manager.reportPlayerEvent(YSPlayerEvents.CLICK);
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
    return Object.keys(YospacePlayerEvent).map((key: string) => {
      return YospacePlayerEvent[key as any];
    }).includes(eventType);
  }
}
