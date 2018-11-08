///<reference path="Yospace.d.ts"/>
import {
  AudioQuality,
  AudioTrack,
  DownloadedAudioData,
  DownloadedVideoData,
  LogLevel,
  MetadataType,
  Player,
  PlayerAdvertisingAPI,
  PlayerAPI,
  PlayerConfig,
  PlayerEvent,
  PlayerEventBase,
  PlayerEventCallback,
  PlayerExports,
  PlayerSubtitlesAPI,
  PlayerType,
  PlayerVRAPI,
  QueryParameters,
  SegmentMap,
  Snapshot,
  SourceConfig,
  StreamType,
  Technology,
  Thumbnail,
  TimeChangedEvent,
  TimeRange,
  VideoQuality,
  ViewMode,
  ViewModeOptions
} from 'bitmovin-player';
import { ArrayUtils, UIFactory } from 'bitmovin-player-ui';
import { YospaceAdListener } from "./YospaceListener";

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
  private player: PlayerAPI;
  private yospaceListener: YospaceAdListener;

  // Yospace fields
  private manager: YSSessionManager;
  private playerPolicy: YSPlayerPolicy;

  // TODO: override ads module
  readonly ads: PlayerAdvertisingAPI;
  readonly exports: PlayerExports;
  readonly subtitles: PlayerSubtitlesAPI;
  readonly version: string;
  readonly vr: PlayerVRAPI;

  private eventHandlers: { [eventType: string]: PlayerEventCallback[]; } = {};

  // TODO: consider custom YospacePlayerConfig if something is needed (DEBUGGING discussion)
  constructor(containerElement: HTMLElement, config: PlayerConfig) {
    // TODO: find out if there is a way to use default ui handling
    let setupUI = config.ui === undefined || config.ui === true;
    // do not use default UI loading. UI can't not be loaded when player is initialized in this file.
    config.ui = false;

    // initialize bitmovin player
    this.player = new Player(containerElement, config);
    this.version = this.player.version;
    this.ads = this.player.ads;
    this.exports = this.player.exports;
    this.subtitles = this.player.subtitles;
    this.vr = this.player.vr;

    // set bitmovin player ui if not prohibited
    if (setupUI) {
      UIFactory.buildDefaultUI(this);
    }

    // TODO: combine in something like a reportPlayerState method called for multiple events
    let onPlay = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.START);
    };

    let onTimeChanged = (event: TimeChangedEvent) => {
      this.manager.reportPlayerEvent(YSPlayerEvents.POSITION, event.time);
    };

    let onPause = () => {
      this.manager.reportPlayerEvent(YSPlayerEvents.PAUSE);
    };

    this.player.on(PlayerEvent.Playing, onPlay);
    this.player.on(PlayerEvent.Paused, onPause);
    this.player.on(PlayerEvent.TimeChanged, onTimeChanged);

    // TODO: Yospace Validator
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
            this.yospaceListener = new YospaceAdListener(this);
            this.manager.registerPlayer(this.yospaceListener);

            // Initialize policy
            this.playerPolicy = new YSPlayerPolicy(this.manager.session);
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

  fireEvent(event: PlayerEventBase): void {
    if (this.eventHandlers[event.type] === undefined) {
      return;
    }

    for (let callback of this.eventHandlers[event.type]) {
      callback(event);
    }
  }

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    this.player.off(eventType, callback);
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  on(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    this.player.on(eventType, callback);
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);
  }

  play(issuer?: string): Promise<void> {
    if (this.playerPolicy.canStart()) {
      if (this.isAdActive() && this.player.isPaused()) {
        this.getCurrentAd().adResumed();
      }
      return this.player.play(issuer);
    }

    // TODO: reason
    return Promise.reject()
  }

  pause(issuer?: string): void {
    if (this.playerPolicy.canPause()) {
      if (this.isAdActive() && this.player.isPlaying()) {
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
    if (this.playerPolicy.canSeek()) {
      let allowedSeekTarget = this.playerPolicy.canSeekTo(time);

      return this.player.seek(allowedSeekTarget, issuer);
    } else {
      // TODO: feedback handling (all policy checks)
      console.log('[policy] seeking not allowed')
    }
  }

  setViewMode(viewMode: ViewMode, options?: ViewModeOptions): void {
    // enter or exit fullscreen
    if (viewMode === ViewMode.Fullscreen || viewMode === ViewMode.Inline) {
      if (this.playerPolicy.canChangeFullScreen(viewMode === ViewMode.Fullscreen)) {
        this.player.setViewMode(viewMode, options);
      }
    } else {
      this.player.setViewMode(viewMode, options);
    }
  }

  // Helper
  private isAdActive(): boolean {
    return !!this.getCurrentAd();
  }

  private getCurrentAd(): YSAdvert | null {
    return this.manager.session.currentAdvert;
  }

  // Default PlayerAPI implementation
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

  getCurrentTime(): number {
    return this.player.getCurrentTime();
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

  getDuration(): number {
    return this.player.getDuration();
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
