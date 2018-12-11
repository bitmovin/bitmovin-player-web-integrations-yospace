///<reference path="Yospace.d.ts"/>
import {
  AdBreak, AdBreakEvent, AdConfig, AdEvent, AdQuartile, AdQuartileEvent, AudioQuality, AudioTrack, BufferLevel,
  BufferType, DownloadedAudioData, DownloadedVideoData, LinearAd, LogLevel, MediaType, MetadataParsedEvent,
  MetadataType, Player, PlayerAdvertisingAPI, PlayerAPI, PlayerBufferAPI, PlayerConfig, PlayerEvent, PlayerEventBase,
  PlayerEventCallback, PlayerExports, PlayerSubtitlesAPI, PlayerType, PlayerVRAPI, QueryParameters, SeekEvent,
  SegmentMap, Snapshot, SourceConfig, StreamType, Technology, Thumbnail, TimeChangedEvent, TimeRange, VideoQuality,
  ViewMode, ViewModeOptions,
} from 'bitmovin-player';
import {
  BYSAdBreakEvent, BYSAdEvent, BYSAnalyticsFiredEvent, BYSListenerEvent, YospaceAdListenerAdapter
} from "./YospaceListenerAdapter";
import { BitmovinYospacePlayerPolicy, DefaultBitmovinYospacePlayerPolicy } from "./BitmovinYospacePlayerPolicy";
import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';

export enum YospaceAssetType {
  LINEAR,
  VOD,
  LINEAR_START_OVER
}

export interface YospaceSourceConfig extends SourceConfig {
  assetType: YospaceAssetType;
}

export interface YospaceConfiguration {
  debug?: boolean;
}

interface StreamPart {
  start: number;
  end: number;
  adBreak?: YSAdBreak;
}

interface StreamPartMapping {
  magic: StreamPart;
  original: StreamPart;
}

export class BitmovinYospacePlayer implements PlayerAPI {
  // Bitmovin Player
  private readonly player: PlayerAPI;
  private eventHandlers: { [eventType: string]: PlayerEventCallback[]; } = {};

  // Yospace fields
  private yospaceConfig: YospaceConfiguration;
  private yospaceSourceConfig: YospaceSourceConfig;
  private manager: YSSessionManager;
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

  constructor(containerElement: HTMLElement, config: PlayerConfig, yospaceConfig: YospaceConfiguration = {}) {
    this.yospaceConfig = yospaceConfig;

    // Clear advertising config
    if (config.advertising) {
      console.warn('Client side advertising config is not supported');
      delete config.advertising;
    }

    if (config.ui === undefined || config.ui) {
      console.warn('Please setup the UI after initializing the yospace player');
      config.ui = false;
    }

    // initialize bitmovin player
    this.player = new Player(containerElement, config);

    // TODO: combine in something like a reportPlayerState method called for multiple events
    const onPlay = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.START);
    };

    const onTimeChanged = (event: TimeChangedEvent) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.POSITION, event.time);

      // fire magic time-changed event
      this.fireEvent<TimeChangedEvent>({
        timestamp: Date.now(),
        type: PlayerEvent.TimeChanged,
        time: this.getCurrentTime()
      });
    };

    const onPause = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.PAUSE);
    };

    const onSourceLoaded = () => {
      if (this.yospaceSourceConfig.assetType === YospaceAssetType.VOD) {
        const session = this.manager.session;
        const timeline = session.timeline;
        // calculate duration magic
        timeline.getAllElements().forEach((element) => {
          const originalChunk: StreamPart = {
            start: element.offset,
            end: element.offset + element.duration
          };

          switch (element.type) {
            case YSTimelineElement.ADVERT:
              originalChunk.adBreak = element.adBreak;

              this.adParts.push(originalChunk);
              break;
            case YSTimelineElement.VOD:

              const magicalContentChunk = {
                start: this.contentDuration,
                end: this.contentDuration + element.duration
              };

              this.contentMapping.push({
                magic: magicalContentChunk,
                original: originalChunk
              });

              this.contentDuration += element.duration;
              break;
          }
        });
      }

      this.fireEvent({
        timestamp: Date.now(),
        type: PlayerEvent.SourceLoaded,
      });
    };

    const onSeek = (event: SeekEvent) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_START, this.player.getCurrentTime());
    };

    const onSeeked = (event: SeekEvent) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_END, this.player.getCurrentTime());
    };

    const onMetaData = (event: MetadataParsedEvent) => {
      const charsToStr = (arr: [number]) => {
        return arr.filter(char => char > 31 && char < 127).map(char => String.fromCharCode(char)).join('');
      };

      const metadata = event.metadata as any;
      const id3Object: any = {
        startTime: event.start ? event.start : this.player.getCurrentTime(),
      };

      // only check some needed id3 tags
      const neededId3Tags = ['YMID', 'YDUR', 'YSEQ', 'YTYP', 'YSCP'];
      for (let frame of metadata.frames) {
        const key = (frame as any).key;

        if (!neededId3Tags.includes(key)) {
          console.log("Ignoring un-needed ID3 tag: " + key);
          continue;
        }

        id3Object[key] = charsToStr((frame as any).data);
      }

      this.manager.reportPlayerEvent(YSPlayerEvents.METADATA, id3Object);
    };

    this.player.on(PlayerEvent.Playing, onPlay);
    this.player.on(PlayerEvent.TimeChanged, onTimeChanged);
    this.player.on(PlayerEvent.Paused, onPause);

    this.player.on(PlayerEvent.Seek, onSeek);
    this.player.on(PlayerEvent.Seeked, onSeeked);

    this.player.on(PlayerEvent.SourceLoaded, onSourceLoaded);
    // To support ads in live streams we need to track metadata events
    this.player.on(PlayerEvent.Metadata, onMetaData);
  }

  load(source: YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void> {
    // for now we only support hls source
    if (!source.hls) {
      console.warn('HLS source missing');
      return;
    }
    this.resetState();

    const url = source.hls;

    this.yospaceSourceConfig = source;

    return new Promise<void>(((resolve, reject) => {
      const onInitComplete = (state: YSSessionResult, result: YSSessionStatus) => {
        if (state === YSSessionResult.INITIALISED) {
          // clone source to not modify passed object
          let clonedSource = {
            ...source,
            hls: this.manager.masterPlaylist(), // use received url from yospace
          };

          if (this.manager.isYospaceStream()) {
            this.yospaceListenerAdapter = new YospaceAdListenerAdapter();
            this.bindYospaceEvent();
            this.manager.registerPlayer(this.yospaceListenerAdapter);

            // Initialize policy
            if (!this.playerPolicy) {
              this.playerPolicy = new DefaultBitmovinYospacePlayerPolicy(this);
            }
          } else {
            // TODO: error or just continue with the url?
            console.log("Shutting down SDK on non-yospace stream");
            this.manager.shutdown();
            this.manager = null;
          }

          this.player.load(clonedSource, forceTechnology, disableSeeking).then(resolve).catch(reject);
        } else {
          // TODO: Error handling
          reject();
        }
      };

      const properties = {
        DEBUGGING: Boolean(this.yospaceConfig.debug),
      };

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
          console.error('Undefined YospaceSourceConfig.assetType; Could not obtain session;');
      }
    }));
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

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    this.player.off(eventType, callback);
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  on(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    // we need to suppress some events because they need to be modified first. so don't add it to the actual player
    const suppressedEventTypes = [PlayerEvent.SourceLoaded, PlayerEvent.TimeChanged, PlayerEvent.PlaybackFinished];
    if (!suppressedEventTypes.includes(eventType)) {
      this.player.on(eventType, callback);
    }

    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);
  }

  play(issuer?: string): Promise<void> {
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
    }
  }

  mute(issuer?: string): void {
    if (this.playerPolicy.canMute()) {
      this.player.mute();
    }
  }

  seek(time: number, issuer?: string): boolean {
    // do not use this seek method for seeking within ads (skip) use player.seek(…) instead
    if (!this.playerPolicy.canSeek()) {
      return false;
    }

    const allowedSeekTarget = this.playerPolicy.canSeekTo(time);
    if (allowedSeekTarget !== time) {
      // cache original seek target
      this.cachedSeekTarget = time;
    } else {
      this.cachedSeekTarget = null;
    }

    // magical content seeking
    const originalStreamPart = this.contentMapping.find((mapping: StreamPartMapping) => {
      return mapping.magic.start <= allowedSeekTarget && allowedSeekTarget <= mapping.magic.end
    });

    const elapsedTimeInStreamPart = allowedSeekTarget - originalStreamPart.magic.start;
    const magicSeekTarget = originalStreamPart.original.start + elapsedTimeInStreamPart;

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
    return this.buffer.getLevel(BufferType.ForwardDuration, MediaType.Video).level;
  }

  /**
   * @deprecated Use {@link PlayerBufferAPI.getLevel} instead.
   */
  getAudioBufferLength(): number | null {
    return this.buffer.getLevel(BufferType.ForwardDuration, MediaType.Audio).level;
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
            end: magicEnd - adStart
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
            end: magicRangeEnd
          })
        }
      });
    }

    return magicBufferedRanges;
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

  private fireEvent<E extends PlayerEventBase>(event: E): void {
    if (this.eventHandlers[event.type]) {
      this.eventHandlers[event.type].forEach((callback: PlayerEventCallback) => callback(event));
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
    const adBreak = event.adBreak;
    const playerEvent = AdEventsFactory.createAdBreakEvent(this.player, adBreak, PlayerEvent.AdBreakStarted);
    this.fireEvent<AdBreakEvent>(playerEvent);
  };

  private onAdStarted = (event: BYSAdEvent) => {
    const playerEvent = AdEventsFactory.createAdEvent(this.player, PlayerEvent.AdStarted, this.manager, this.getCurrentAd());
    this.fireEvent<AdEvent>(playerEvent);

    if (this.isLive()) {
      // save start position of an ad within a live stream to calculate the current time within the ad
      this.adStartedTimestamp = this.player.getCurrentTime();
    }
    // TODO: autoskip if available
  };

  private onAdFinished = (event: BYSAdEvent) => {
    const playerEvent = AdEventsFactory.createAdEvent(this.player, PlayerEvent.AdFinished, this.manager, this.getCurrentAd());
    this.fireEvent<AdEvent>(playerEvent);
    this.adStartedTimestamp = null;
  };

  private onAdBreakFinished = (event: BYSAdBreakEvent) => {
    const adBreak = event.adBreak;
    const playerEvent = AdEventsFactory.createAdBreakEvent(this.player, adBreak, PlayerEvent.AdBreakFinished);
    this.fireEvent<AdBreakEvent>(playerEvent);

    if (this.cachedSeekTarget) {
      this.seek(this.cachedSeekTarget, "yospace-ad-skipping");
      this.cachedSeekTarget = null;
    }
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

  private mapAdBreak(ysAdBreak: YSAdBreak): AdBreak {
    return {
      id: ysAdBreak.adBreakIdentifier, // can be null
      scheduleTime: this.toMagicTime(ysAdBreak.startPosition),
      ads: ysAdBreak.adverts.map(this.mapAd)
    };
  }

  private mapAd(ysAd: YSAdvert): LinearAd {
    return {
      isLinear: Boolean(ysAd.advert.linear),
      duration: ysAd.duration,
      id: ysAd.advert.id,
      clickThroughUrl: ysAd.advert.linear.clickThrough,
      mediaFileUrl: ysAd.advert.linear.mediaFiles[0].src,
      skippableAfter: ysAd.advert.linear.skipOffset,
      uiConfig: {
        requestsUi: true,
      },
    };
  }

  private mapAdQuartile(quartileEvent: string): AdQuartile {
    switch (quartileEvent) {
      case 'firstQuartile':
        return AdQuartile.FIRST_QUARTILE;
      case 'midpoint':
        return AdQuartile.MIDPOINT;
      case 'thirdQuartile':
        return AdQuartile.THIRD_QUARTILE;
    }
  };

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
    if (this.manager) {
      this.manager.shutdown();
      this.manager = null;
    }

    this.contentDuration = 0;
    this.contentMapping = [];
    this.adParts = [];
    this.adStartedTimestamp = null;
    this.cachedSeekTarget = null;
  }

  private handleQuartileEvent(adQuartileEventName: string): void {
    const playerEvent: AdQuartileEvent = {
      timestamp: Date.now(),
      type: PlayerEvent.AdQuartile,
      quartile: this.mapAdQuartile(adQuartileEventName),
    };

    this.fireEvent(playerEvent);
  }

  // Custom advertising module with overwritten methods
  private advertisingApi: PlayerAdvertisingAPI = {
    discardAdBreak: (adBreakId: string) => {
      console.warn('CSAI is not supported for yospace stream');
      return;
    },

    getActiveAdBreak: () => {
      if (!this.isAdActive()) {
        return undefined;
      }

      return this.mapAdBreak(this.getCurrentAd().adBreak);
    },

    getActiveAd: () => {
      if (!this.isAdActive()) {
        return undefined;
      }

      return this.mapAd(this.getCurrentAd());
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
      if (this.isAdActive() && this.playerPolicy.canSkip() === 0) {
        const ad = this.getCurrentAd();
        const seekTarget = this.getAdStartTime(ad) + ad.duration;

        if (seekTarget >= this.player.getDuration()) {
          // this.player.unload();
          // TODO: we can't seek to the very very end so an unload may fix the problem
        } else {
          this.player.seek(seekTarget, 'ad-skip');

          this.fireEvent({
            timestamp: Date.now(),
            type: PlayerEvent.AdSkipped,
            ad: this.mapAd(ad)
          } as AdEvent);
        }
      }
    },

    getModuleInfo: () => {
      return this.player.ads.getModuleInfo();
    }
  };

  private bufferApi: PlayerBufferAPI = {
    setTargetLevel: (type: BufferType, value: number, media: MediaType) => {
      this.player.buffer.setTargetLevel(type, value, media);
    },

    getLevel: (type: BufferType, media: MediaType) => {
      const bufferLevel = this.player.buffer.getLevel(type, media);
      bufferLevel.level = this.magicBufferLevel(bufferLevel);
      return bufferLevel;
    }
  };

  unload(): Promise<void> {
    this.resetState();

    return this.player.unload();
  }

  // Default PlayerAPI implementation
  get version(): string {
    return this.player.version;
  }

  get vr(): PlayerVRAPI {
    return this.player.vr;
  }

  get subtitles(): PlayerSubtitlesAPI {
    return this.player.subtitles;
  }

  /**
   * @deprecated
   */
  get exports(): PlayerExports {
    return this.player.exports;
  }

  addMetadata(metadataType: MetadataType.CAST, metadata: any): boolean {
    return this.player.addMetadata(metadataType, metadata);
  }

  castStop(): void {
    this.player.castStop();
  }

  castVideo(): void {
    this.player.castVideo();
  }

  clearQueryParameters(): void {
    this.player.clearQueryParameters();
  }

  destroy(): Promise<void> {
    return this.player.destroy();
  }

  getAudio(): AudioTrack {
    return this.player.getAudio();
  }

  getAudioQuality(): AudioQuality {
    return this.player.getAudioQuality();
  }

  getAvailableAudio(): AudioTrack[] {
    return this.player.getAvailableAudio();
  }

  getAvailableAudioQualities(): AudioQuality[] {
    return this.player.getAvailableAudioQualities();
  }

  getAvailableSegments(): SegmentMap {
    return this.player.getAvailableSegments();
  }

  getAvailableVideoQualities(): VideoQuality[] {
    return this.player.getAvailableVideoQualities();
  }

  getConfig(mergedConfig?: boolean): PlayerConfig {
    return this.player.getConfig(mergedConfig);
  }

  getContainer(): HTMLElement {
    return this.player.getContainer();
  }

  getDownloadedAudioData(): DownloadedAudioData {
    return this.player.getDownloadedAudioData();
  }

  getDownloadedVideoData(): DownloadedVideoData {
    return this.player.getDownloadedVideoData();
  }

  getDroppedVideoFrames(): number {
    return this.player.getDroppedVideoFrames();
  }

  getManifest(): string {
    return this.player.getManifest();
  }

  getMaxTimeShift(): number {
    return this.player.getMaxTimeShift();
  }

  getPlaybackAudioData(): AudioQuality {
    return this.player.getPlaybackAudioData();
  }

  getPlaybackSpeed(): number {
    return this.player.getPlaybackSpeed();
  }

  getPlaybackVideoData(): VideoQuality {
    return this.player.getPlaybackVideoData();
  }

  getPlayerType(): PlayerType {
    return this.player.getPlayerType();
  }

  getSeekableRange(): TimeRange {
    return this.player.getSeekableRange();
  }

  getSnapshot(type?: string, quality?: number): Snapshot {
    return this.player.getSnapshot(type, quality);
  }

  getSource(): SourceConfig | null {
    return this.player.getSource();
  }

  getStreamType(): StreamType {
    return this.player.getStreamType();
  }

  getSupportedDRM(): Promise<string[]> {
    return this.player.getSupportedDRM();
  }

  getSupportedTech(): Technology[] {
    return this.player.getSupportedTech();
  }

  getThumbnail(time: number): Thumbnail {
    return this.player.getThumbnail(time);
  }

  getTimeShift(): number {
    return this.player.getTimeShift();
  }

  getTotalStalledTime(): number {
    return this.player.getTotalStalledTime();
  }

  getVideoElement(): HTMLVideoElement | HTMLObjectElement {
    return this.player.getVideoElement();
  }

  getVideoQuality(): VideoQuality {
    return this.player.getVideoQuality();
  }

  getViewMode(): ViewMode {
    return this.player.getViewMode();
  }

  getVolume(): number {
    return this.player.getVolume();
  }

  hasEnded(): boolean {
    return this.player.hasEnded();
  }

  isAirplayActive(): boolean {
    return this.player.isAirplayActive();
  }

  isAirplayAvailable(): boolean {
    return this.player.isAirplayAvailable();
  }

  isCastAvailable(): boolean {
    return this.player.isCastAvailable();
  }

  isCasting(): boolean {
    return this.player.isCasting();
  }

  isDRMSupported(drmSystem: string): Promise<string> {
    return this.player.isDRMSupported(drmSystem);
  }

  isLive(): boolean {
    return this.player.isLive();
  }

  isMuted(): boolean {
    return this.player.isMuted();
  }

  isPaused(): boolean {
    return this.player.isPaused();
  }

  isPlaying(): boolean {
    return this.player.isPlaying();
  }

  isStalled(): boolean {
    return this.player.isStalled();
  }

  isViewModeAvailable(viewMode: ViewMode): boolean {
    return this.player.isViewModeAvailable(viewMode);
  }

  preload(): void {
    this.player.preload();
  }

  setAudio(trackID: string): void {
    this.player.setAudio(trackID);
  }

  setAudioQuality(audioQualityID: string): void {
    this.player.setAudioQuality(audioQualityID);
  }

  setAuthentication(customData: any): void {
    this.player.setAuthentication(customData);
  }

  setLogLevel(level: LogLevel): void {
    this.player.setLogLevel(level);
  }

  setPlaybackSpeed(speed: number): void {
    // TODO: handle this; set playback-speed to 1 if ad is starts and reset afterwards; do not allow changing during ad
    this.player.setPlaybackSpeed(speed);
  }

  setPosterImage(url: string, keepPersistent: boolean): void {
    this.player.setPosterImage(url, keepPersistent);
  }

  setQueryParameters(queryParameters: QueryParameters): void {
    this.player.setQueryParameters(queryParameters);
  }

  setVideoElement(videoElement: HTMLElement): void {
    this.player.setVideoElement(videoElement);
  }

  setVideoQuality(videoQualityID: string): void {
    this.player.setVideoQuality(videoQualityID);
  }

  setViewMode(viewMode: ViewMode, options?: ViewModeOptions): void {
    this.player.setViewMode(viewMode, options);
  }

  setVolume(volume: number, issuer?: string): void {
    this.player.setVolume(volume);
  }

  showAirplayTargetPicker(): void {
    this.player.showAirplayTargetPicker();
  }

  timeShift(offset: number, issuer?: string): void {
    this.player.timeShift(offset, issuer);
  }

  unmute(issuer?: string): void {
    this.player.unmute(issuer);
  }
}

class AdEventsFactory {
  static createAdBreakEvent(player: PlayerAPI, adBreak: YSAdBreak, type: PlayerEvent): AdBreakEvent {
    return {
      timestamp: Date.now(),
      type: type,
      adBreak: {
        id: adBreak.adBreakIdentifier, // can be null
        scheduleTime: adBreak.startPosition
      }
    };
  }

  static createAdEvent(player: PlayerAPI, type: PlayerEvent, manager: YSSessionManager, ad: YSAdvert): AdEvent {
    return {
      timestamp: Date.now(),
      type: type,
      ad: {
        isLinear: true,
        duration: ad.duration,
        skippableAfter: player.isLive() ? -1 : ad.advert.linear.skipOffset,
        clickThroughUrl: manager.session.getLinearClickthrough(),
        clickThroughUrlOpened: () => {
          manager.reportPlayerEvent(YSPlayerEvents.CLICK);
        },
        uiConfig: {
          requestsUi: true,
        }
      } as LinearAd
    };
  }
}
