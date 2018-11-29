///<reference path="Yospace.d.ts"/>
import {
  AdBreak, AdBreakEvent, ViewMode, ViewModeOptions,
  AdConfig, AdEvent, AudioQuality, AudioTrack, DownloadedAudioData, DownloadedVideoData, LinearAd, LogLevel,
  MetadataType, PlaybackEvent, Player, PlayerAdvertisingAPI, PlayerAPI, PlayerConfig, PlayerEvent, PlayerEventBase,
  PlayerEventCallback, PlayerExports, PlayerSubtitlesAPI, PlayerType, PlayerVRAPI, QueryParameters, SegmentMap,
  Snapshot, SourceConfig, StreamType, Technology, Thumbnail, TimeChangedEvent, TimeRange, VideoQuality
} from 'bitmovin-player';
import { BYSAdBreakEvent, BYSAdEvent, BYSListenerEvent, YospaceAdListenerAdapter } from "./YospaceListenerAdapter";
import { BitmovinYospacePlayerPolicy, DefaultBitmovinYospacePlayerPolicy } from "./BitmovinYospacePlayerPolicy";
import { ArrayUtils } from "./utils/arrayutils";

enum YospaceAssetType {
  LINEAR,
  VOD,
  LINEAR_START_OVER
}

interface YospaceSourceConfig extends SourceConfig {
  type: YospaceAssetType;
}

export class BitmovinYospacePlayer implements PlayerAPI {
  // Bitmovin Player
  private readonly player: PlayerAPI;
  private eventHandlers: { [eventType: string]: PlayerEventCallback[]; } = {};

  // Yospace fields
  private manager: YSSessionManager;
  private yospaceListenerAdapter: YospaceAdListenerAdapter;
  private playerPolicy: BitmovinYospacePlayerPolicy;

  // TODO: consider custom YospacePlayerConfig if something is needed (DEBUGGING discussion)
  constructor(containerElement: HTMLElement, config: PlayerConfig) {
    // initialize bitmovin player
    this.player = new Player(containerElement, config);

    // TODO: combine in something like a reportPlayerState method called for multiple events
    let onPlay = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.START);
    };

    let onTimeChanged = (event: TimeChangedEvent) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.POSITION, event.time);

      // TODO: will be needed for magic time calculation
      this.fireEvent<TimeChangedEvent>({
        timestamp: Date.now(),
        type: PlayerEvent.TimeChanged,
        time: this.getCurrentTime()
      } as TimeChangedEvent);
    };

    let onPause = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.PAUSE);
    };

    let onSourceLoaded = () => {
      // TODO: will be needed for magic time calculation
      this.fireEvent<PlayerEventBase>({
        timestamp: Date.now(),
        type: PlayerEvent.SourceLoaded,
      });
    };

    let onSeek = (event: any) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_START, this.player.getCurrentTime());
    };

    let onSeeked = (event: any) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.SEEK_END, this.player.getCurrentTime());
    };

    this.player.on(PlayerEvent.Playing, onPlay);
    this.player.on(PlayerEvent.TimeChanged, onTimeChanged);
    this.player.on(PlayerEvent.Paused, onPause);

    this.player.on(PlayerEvent.Seek, onSeek);
    this.player.on(PlayerEvent.Seeked, onSeeked);

    this.player.on(PlayerEvent.SourceLoaded, onSourceLoaded);
  }

  load(source: YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void> {
    // for now we only support hls source
    if (!source.hls) {
      console.warn('HLS source missing');
      return;
    }
    let url = source.hls;

    // TODO: add to config
    YSSessionManager.DEFAULTS.DEBUGGING = true;

    return new Promise<void>(((resolve, reject) => {
      let onInitComplete = (state: YSSessionResult, result: YSSessionStatus) => {
        if (state === YSSessionResult.INITIALISED) {
          // use received url from yospace
          source.hls = this.manager.masterPlaylist();

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

          this.player.load(source, forceTechnology, disableSeeking).then(resolve).catch(reject);
        } else {
          // TODO: Error handling
          reject();
        }
      };

      // TODO: respect config flag
      this.manager = YSSessionManager.createForVoD(url, null, onInitComplete);

      switch (source.type) {
        case YospaceAssetType.LINEAR:
          break;
        case YospaceAssetType.VOD:
          break;
        case YospaceAssetType.LINEAR_START_OVER:
          break;
        default:
        // TODO: undefined
      }
    }));
  }

  get ads(): PlayerAdvertisingAPI {
    return this.advertisingModule;
  }

  setPolicy(policy: BitmovinYospacePlayerPolicy) {
    this.playerPolicy = policy;
  }

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    this.player.off(eventType, callback);
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  on(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    if (eventType !== PlayerEvent.SourceLoaded &&
      eventType !== PlayerEvent.TimeChanged &&
      eventType !== PlayerEvent.PlaybackFinished) {
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
    if (!this.playerPolicy.canSeek()) {
      return false;
    }

    return this.player.seek(time, issuer);
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime();
  }

  getDuration(): number {
    if (this.isAdActive()) {
      return this.getCurrentAd().duration;
    }
    return this.player.getDuration();
  }

  // Helper
  private isAdActive(): boolean {
    return !!this.getCurrentAd();
  }

  private getCurrentAd(): YSAdvert | null {
    if (!this.manager) {
      return;
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
  }

  private onAdBreakStarted = (event: BYSAdBreakEvent) => {
    let adBreak = event.adBreak;
    let playerEvent = AdEventsFactory.createAdBreakEvent(this.player, adBreak, PlayerEvent.AdBreakStarted);
    this.fireEvent<AdBreakEvent>(playerEvent);
  };

  private onAdStarted = (event: BYSAdEvent) => {
    let playerEvent = AdEventsFactory.createAdEvent(this.player, PlayerEvent.AdStarted, this.playerPolicy, this.manager);
    this.fireEvent<AdEvent>(playerEvent);
    // TODO: autoskip if available
  };

  private onAdFinished = (event: BYSAdEvent) => {
    let playerEvent = AdEventsFactory.createAdEvent(this.player, PlayerEvent.AdFinished, this.playerPolicy, this.manager);
    this.fireEvent<AdEvent>(playerEvent);
  };

  private onAdBreakFinished = (event: BYSAdBreakEvent) => {
    let adBreak = event.adBreak;
    let playerEvent = AdEventsFactory.createAdBreakEvent(this.player, adBreak, PlayerEvent.AdBreakFinished);
    this.fireEvent<AdBreakEvent>(playerEvent);
  };

  // Custom advertising module with overwritten methods
  private advertisingModule: PlayerAdvertisingAPI = {
    discardAdBreak: (adBreakId: string) => {
      console.warn('CSAI is not supported for yospace stream');
      return;
    },

    getActiveAdBreak: () => {
      // TODO: map YSAdBreak to AdBreak
      return undefined;
    },

    isLinearAdActive: () => {
      return this.isAdActive();
    },

    list: () => {
      // TODO: go through timeline and return YSAdBreaks mapped to AdBreak
      return [];
    },

    schedule: (adConfig: AdConfig) => {
      console.warn('CSAI is not supported for yospace stream');
      return undefined;
    },

    skip: () => {
      if (this.isAdActive() && this.playerPolicy.canSkip() === 0) {
        let ad = this.getCurrentAd();
        let indexInAdBreak = ad.adBreak.adverts.indexOf(ad);
        let previousAdverts: YSAdvert[] = ad.adBreak.adverts.slice(0, indexInAdBreak);

        // TODO: the performance should be improved
        let startTime = ad.adBreak.startPosition + previousAdverts.reduce((pv, cv) => pv + cv.duration, 0);

        let seekTarget = startTime + ad.duration;
        if (seekTarget >= this.player.getDuration()) {
          // this.player.unload();
          // TODO: we can't seek to the very very end so an unload may fix the problem
        } else {
          this.player.seek(seekTarget, 'ad-skip');
        }
      }
    },
  };

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

  getAudioBufferLength(): number | null {
    return this.player.getAudioBufferLength();
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

  getBufferedRanges(): TimeRange[] {
    return this.player.getBufferedRanges();
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

  getVideoBufferLength(): number | null {
    return this.player.getVideoBufferLength();
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
    // TODO: check if post-roll count as hasEnded
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

  unload(): Promise<void> {
    return this.player.unload();
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
        id: 'someId', // TODO: find id (or generate some)
        scheduleTime: adBreak.startPosition
      }
    };
  }

  static createAdEvent(player: PlayerAPI, type: PlayerEvent, policy: BitmovinYospacePlayerPolicy, manager: YSSessionManager): AdEvent {
    console.log('skippable after', policy.canSkip());
    return {
      timestamp: Date.now(),
      type: type,
      ad: {
        isLinear: true,
        requiresUi: true,
        skippableAfter: policy.canSkip(),
        clickThroughUrl: manager.session.getLinearClickthrough(),
        adClickedCallback: () => {
          manager.reportPlayerEvent(PlayerEvent.AdClicked);
        }
      } as LinearAd
    };
  }
}
