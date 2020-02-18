import {
  AudioQuality, AudioTrack, DownloadedAudioData, DownloadedVideoData, LogLevel, LowLatencyAPI, MetadataType, Player,
  PlayerAPI, PlayerBufferAPI, PlayerConfig, PlayerEvent, PlayerEventCallback, PlayerManifestAPI, PlayerType,
  QueryParameters, SegmentMap, Snapshot, SourceConfig, StreamType, SupportedTechnologyMode, Technology, Thumbnail,
  TimeRange, VideoQuality, ViewMode, ViewModeOptions,
} from 'bitmovin-player/modules/bitmovinplayer-core';
import { InternalBitmovinYospacePlayer } from './InternalBitmovinYospacePlayer';

import PolyfillModule from 'bitmovin-player/modules/bitmovinplayer-polyfill';
import XMLModule from 'bitmovin-player/modules/bitmovinplayer-xml';
import StyleModule from 'bitmovin-player/modules/bitmovinplayer-style';
import AdvertisingCoreModule, { PlayerAdvertisingAPI } from 'bitmovin-player/modules/bitmovinplayer-advertising-core';
import AdvertisingBitmovinModule from 'bitmovin-player/modules/bitmovinplayer-advertising-bitmovin';
import MSERendererModule from 'bitmovin-player/modules/bitmovinplayer-mserenderer';
import EngineBitmovinModule from 'bitmovin-player/modules/bitmovinplayer-engine-bitmovin';
import HLSModule from 'bitmovin-player/modules/bitmovinplayer-hls';
import DASHModule from 'bitmovin-player/modules/bitmovinplayer-dash';
import ABRModule from 'bitmovin-player/modules/bitmovinplayer-abr';
import ContainerMP4Module from 'bitmovin-player/modules/bitmovinplayer-container-mp4';
import ContainerTSModule from 'bitmovin-player/modules/bitmovinplayer-container-ts';
import SubtitlesModule, { PlayerSubtitlesAPI } from 'bitmovin-player/modules/bitmovinplayer-subtitles';
import SubtitlesCEA608Module from 'bitmovin-player/modules/bitmovinplayer-subtitles-cea608';
import SubtitlesNativeModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-native';
import SubtitlesVTTModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-vtt';
import SubtitlesTTMLModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-ttml';
import ThumbnailModule from 'bitmovin-player/modules/bitmovinplayer-thumbnail';
import CryptoModule from 'bitmovin-player/modules/bitmovinplayer-crypto';
import PatchModule from 'bitmovin-player/modules/bitmovinplayer-patch';
import AnalyticsModule from 'bitmovin-player/modules/bitmovinplayer-analytics';
import EngineNativeModule from 'bitmovin-player/modules/bitmovinplayer-engine-native';
import DRMModule from 'bitmovin-player/modules/bitmovinplayer-drm';
import RemoteControlModule from 'bitmovin-player/modules/bitmovinplayer-remotecontrol';
import ServiceWorkerClientModule from 'bitmovin-player/modules/bitmovinplayer-serviceworker-client';

import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';
import { PlayerVRAPI } from 'bitmovin-player';
import {
  BitmovinYospacePlayerAPI, BitmovinYospacePlayerExports, BitmovinYospacePlayerPolicy, YospaceAssetType,
  YospaceConfiguration, YospaceErrorCode, YospacePlayerEvent, YospacePlayerEventCallback, YospacePlayerType,
  YospacePolicyErrorCode, YospaceSourceConfig,
} from './BitmovinYospacePlayerAPI';
import { Logger } from './Logger';
import { BitmovinYospaceHelper } from './BitmovinYospaceHelper';
import stringify from 'fast-safe-stringify';

export class BitmovinYospacePlayer implements BitmovinYospacePlayerAPI {
  private player: BitmovinYospacePlayerAPI;
  private bitmovinYospacePlayer: BitmovinYospacePlayerAPI;
  private bitmovinPlayer: PlayerAPI;
  private currentPlayerType: YospacePlayerType = YospacePlayerType.BitmovinYospace;

  private containerElement: HTMLElement;
  private config: PlayerConfig;
  private yospaceConfig: YospaceConfiguration;
  // Collect all eventHandlers to reattach them to the current used player
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[]; } = {};

  constructor(containerElement: HTMLElement, config: PlayerConfig, yospaceConfig: YospaceConfiguration = {}) {
    this.containerElement = containerElement;
    this.config = config;
    this.yospaceConfig = yospaceConfig;

    if (yospaceConfig.debug) {
      Logger.enable();
    }

    // Clear advertising config
    if (config.advertising) {
      Logger.warn('Client side advertising config is not supported. If you are using the BitmovinPlayer as' +
        'fallback please use player.ads.schedule');
    }
    // add advertising again to load ads module
    config.advertising = {};

    if (config.ui === undefined || config.ui) {
      Logger.warn('Please setup the UI after initializing the yospace player');
      config.ui = false;
    }

    Logger.log('[BitmovinYospacePlayer] creating BitmovinPlayer with configuration ' + stringify(this.config));

    // initialize bitmovin player
    Player.addModule(PolyfillModule);
    Player.addModule(XMLModule);
    Player.addModule(StyleModule);
    Player.addModule(AdvertisingCoreModule);
    Player.addModule(AdvertisingBitmovinModule);
    Player.addModule(MSERendererModule);
    Player.addModule(EngineNativeModule);
    Player.addModule(EngineBitmovinModule);
    Player.addModule(HLSModule);
    Player.addModule(DASHModule);
    Player.addModule(ABRModule);
    Player.addModule(ContainerMP4Module);
    Player.addModule(ContainerTSModule);
    Player.addModule(SubtitlesModule);
    Player.addModule(SubtitlesCEA608Module);
    Player.addModule(SubtitlesNativeModule);
    Player.addModule(SubtitlesVTTModule);
    Player.addModule(SubtitlesTTMLModule);
    Player.addModule(ThumbnailModule);
    Player.addModule(CryptoModule);
    Player.addModule(PatchModule);
    Player.addModule(AnalyticsModule);
    Player.addModule(DRMModule);
    Player.addModule(RemoteControlModule);
    Player.addModule(ServiceWorkerClientModule);
  }

  setup(): Promise<void> {
    return this.unregisterAllServiceWorker().then().catch().then(() => {
        this.createPlayer();
      },
    );
  }

  private createPlayer(): void {
    if (BitmovinYospaceHelper.isSafari() || BitmovinYospaceHelper.isSafariIOS()) {
      if (!this.config.location) {
        this.config.location = {};
      }

      if (!this.config.tweaks) {
        this.config.tweaks = {};
      }

      if (!this.yospaceConfig.disableServiceWorker) {
        if (!this.config.location.serviceworker) {
          this.config.location.serviceworker = './sw.js';
        }

        if (!this.config.tweaks.native_hls_parsing) {
          this.config.tweaks.native_hls_parsing = true;
        }
      }

      Logger.log('Loading the ServiceWorkerModule');
    }
    this.bitmovinPlayer = new Player(this.containerElement, this.config);

    this.bitmovinYospacePlayer = new InternalBitmovinYospacePlayer(
      this.containerElement,
      this.bitmovinPlayer,
      this.yospaceConfig,
    ) as any as BitmovinYospacePlayerAPI;

    this.player = this.bitmovinYospacePlayer;
  }

  unregisterAllServiceWorker(): Promise<void> {
    if (navigator.serviceWorker) {
      return navigator.serviceWorker.getRegistrations().then((registrations) => {
        return Promise
          .all(registrations.map(registration => registration.unregister()))
          .then(() => {
          });
      });
    } else {
      return Promise.resolve();
    }
  }

  load(source: SourceConfig | YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const isAssetTypePresent = (): boolean => {
        return source.hasOwnProperty('assetType') && (source as YospaceSourceConfig).assetType !== undefined;
      };

      const switchPlayer = (toType: YospacePlayerType) => {
        this.player.unload().then(() => {
          const oldPlayer: BitmovinYospacePlayerAPI = this.player;
          if (toType === YospacePlayerType.Bitmovin) {
            this.player = this.bitmovinPlayer as BitmovinYospacePlayerAPI;
          } else {
            this.player = this.bitmovinYospacePlayer;
          }

          this.currentPlayerType = toType;

          for (let eventType of Object.keys(this.eventHandlers)) {
            for (let eventCallback of this.eventHandlers[eventType]) {
              oldPlayer.off(eventType as YospacePlayerEvent, eventCallback);
              this.player.on(eventType as YospacePlayerEvent, eventCallback);
            }
          }

          Logger.log('BitmovinYospacePlayer loading source after switching players- ' + stringify(source));

          this.player.load(source, forceTechnology, disableSeeking).then(resolve).catch(reject);
        }).catch(reject);
      };

      // Only switch player when necessary
      if (!isAssetTypePresent() && this.currentPlayerType === YospacePlayerType.BitmovinYospace) {
        switchPlayer(YospacePlayerType.Bitmovin);
      } else if (isAssetTypePresent() && this.currentPlayerType === YospacePlayerType.Bitmovin) {
        switchPlayer(YospacePlayerType.BitmovinYospace);
      } else {
        Logger.log('BitmovinYospacePlayer loading source - ' + stringify(source));
        // Else load the source in the current player
        this.player.load(source, forceTechnology, disableSeeking).then(resolve).catch(reject);
      }
    });
  }

  on(eventType: PlayerEvent, callback: PlayerEventCallback): void;
  on(eventType: YospacePlayerEvent, callback: YospacePlayerEventCallback): void;
  on(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);

    this.player.on(eventType, callback);
  }

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void;
  off(eventType: YospacePlayerEvent, callback: YospacePlayerEventCallback): void;
  off(eventType: PlayerEvent | YospacePlayerEvent, callback: YospacePlayerEventCallback | PlayerEventCallback): void {
    this.player.off(eventType, callback);
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  // Since this is not in the PlayerAPI it will be gone when using the BitmovinPlayer so we need a custom implementation
  // here to ensure the feature during the live time of the BitmovinYospacePlayer
  setPolicy(policy: BitmovinYospacePlayerPolicy): void {
    if (this.getCurrentPlayerType() === YospacePlayerType.Bitmovin) {
      Logger.log('[BitmovinYospacePlayer] Policy does not apply for Bitmovin Player but is saved for further ' +
        'BitmovinYospace Player usage');
    }

    this.bitmovinYospacePlayer.setPolicy(policy);
  }

  getCurrentPlayerType(): YospacePlayerType {
    return this.currentPlayerType;
  }

  destroy(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.bitmovinPlayer.destroy().then(() => {
        this.bitmovinYospacePlayer.destroy().then(resolve).catch(reject);
      });
    });
  }

  // Default methods propagated to this.player
  get ads(): PlayerAdvertisingAPI {
    return this.player.ads;
  }

  get buffer(): PlayerBufferAPI {
    return this.player.buffer;
  }

  get exports(): BitmovinYospacePlayerExports {
    return {
      ...this.player.exports,
      YospacePolicyErrorCode: YospacePolicyErrorCode,
      YospacePlayerType: YospacePlayerType,
      YospaceErrorCode: YospaceErrorCode,
      YospaceAssetType: YospaceAssetType,
      YospacePlayerEvent: YospacePlayerEvent,
    };
  }

  get lowlatency(): LowLatencyAPI {
    return this.player.lowlatency;
  }

  get subtitles(): PlayerSubtitlesAPI {
    return this.player.subtitles;
  }

  get version(): string {
    return this.player.version;
  }

  get vr(): PlayerVRAPI {
    return this.player.vr;
  }

  get manifest(): PlayerManifestAPI {
    return this.player.manifest;
  }

  addMetadata(metadataType: MetadataType.CAST, metadata: any): boolean {
    return this.player.addMetadata(metadataType, metadata);
  }

  castStop(): void {
    return this.player.castStop();
  }

  castVideo(): void {
    return this.player.castVideo();
  }

  clearQueryParameters(): void {
    return this.player.clearQueryParameters();
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
    return this.player.getConfig();
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
    return this.player.getSnapshot();
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

  getSupportedTech(mode?: SupportedTechnologyMode): Technology[] {
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

  mute(issuer?: string): void {
    return this.player.mute();
  }

  pause(issuer?: string): void {
    return this.player.pause();
  }

  play(issuer?: string): Promise<void> {
    return this.player.play(issuer);
  }

  preload(): void {
    return this.player.preload();
  }

  seek(time: number, issuer?: string): boolean {
    return this.player.seek(time, issuer);
  }

  setAudio(trackID: string): void {
    return this.player.setAudio(trackID);
  }

  setAudioQuality(audioQualityID: string): void {
    return this.player.setAudioQuality(audioQualityID);
  }

  setAuthentication(customData: any): void {
    return this.player.setAuthentication(customData);
  }

  setLogLevel(level: LogLevel): void {
    return this.player.setLogLevel(level);
  }

  setPlaybackSpeed(speed: number): void {
    return this.player.setPlaybackSpeed(speed);
  }

  setPosterImage(url: string, keepPersistent: boolean): void {
    return this.player.setPosterImage(url, keepPersistent);
  }

  setQueryParameters(queryParameters: QueryParameters): void {
    return this.player.setQueryParameters(queryParameters);
  }

  setVideoElement(videoElement: HTMLElement): void {
    return this.player.setVideoElement(videoElement);
  }

  setVideoQuality(videoQualityID: string): void {
    return this.player.setVideoQuality(videoQualityID);
  }

  setViewMode(viewMode: ViewMode, options?: ViewModeOptions): void {
    return this.player.setViewMode(viewMode, options);
  }

  setVolume(volume: number, issuer?: string): void {
    return this.player.setVolume(volume, issuer);
  }

  showAirplayTargetPicker(): void {
    return this.player.showAirplayTargetPicker();
  }

  timeShift(offset: number, issuer?: string): void {
    return this.player.timeShift(offset, issuer);
  }

  unload(): Promise<void> {
    return this.player.unload();
  }

  unmute(issuer?: string): void {
    return this.player.unmute();
  }
}
