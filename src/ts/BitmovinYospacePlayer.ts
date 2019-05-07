import {
  Player, PlayerAPI, PlayerConfig, PlayerEvent, PlayerEventCallback,
} from 'bitmovin-player/modules/bitmovinplayer-core';
import {
  BitmovinYospacePlayerAPI, InternalBitmovinYospacePlayer, YospaceConfiguration, YospaceSourceConfig,
} from './InternalBitmovinYospacePlayer';
import { YospacePlayerEventCallback } from './YospaceError';
import { BitmovinYospacePlayerPolicy } from './BitmovinYospacePlayerPolicy';

import XMLModule from 'bitmovin-player/modules/bitmovinplayer-xml';
import StyleModule from 'bitmovin-player/modules/bitmovinplayer-style';
import AdvertisingCoreModule from 'bitmovin-player/modules/bitmovinplayer-advertising-core';
import AdvertisingBitmovinModule from 'bitmovin-player/modules/bitmovinplayer-advertising-bitmovin';
import MSERendererModule from 'bitmovin-player/modules/bitmovinplayer-mserenderer';
import EngineBitmovinModule from 'bitmovin-player/modules/bitmovinplayer-engine-bitmovin';
import HLSModule from 'bitmovin-player/modules/bitmovinplayer-hls';
import ABRModule from 'bitmovin-player/modules/bitmovinplayer-abr';
import ContainerMP4Module from 'bitmovin-player/modules/bitmovinplayer-container-mp4';
import ContainerTSModule from 'bitmovin-player/modules/bitmovinplayer-container-ts';
import SubtitlesModule from 'bitmovin-player/modules/bitmovinplayer-subtitles';
import SubtitlesCEA608Module from 'bitmovin-player/modules/bitmovinplayer-subtitles-cea608';
import SubtitlesNativeModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-native';
import SubtitlesVTTModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-vtt';
import SubtitlesTTMLModule from 'bitmovin-player/modules/bitmovinplayer-subtitles-ttml';
import ThumbnailModule from 'bitmovin-player/modules/bitmovinplayer-thumbnail';
import CryptoModule from 'bitmovin-player/modules/bitmovinplayer-crypto';
import PatchModule from 'bitmovin-player/modules/bitmovinplayer-patch';
import PolyfillModule from 'bitmovin-player/modules/bitmovinplayer-polyfill';
import AnalyticsModule from 'bitmovin-player/modules/bitmovinplayer-analytics';
import EngineNativeModule from 'bitmovin-player/modules/bitmovinplayer-engine-native';
import DRMModule from 'bitmovin-player/modules/bitmovinplayer-drm';
import RemoteControlModule from 'bitmovin-player/modules/bitmovinplayer-remotecontrol';
import { ArrayUtils } from 'bitmovin-player-ui';

enum PlayerType {
  Bitmovin,
  BitmovinYospace,
}

// @ts-ignore
export class BitmovinYospacePlayer implements BitmovinYospacePlayerAPI {
  private player: PlayerAPI;
  private readonly bitmovinYospacePlayer: BitmovinYospacePlayerAPI;
  private readonly bitmovinPlayer: PlayerAPI;
  private currentPlayerType: PlayerType = PlayerType.BitmovinYospace;

  private containerElement: HTMLElement;
  private config: PlayerConfig;
  private yospaceConfig: YospaceConfiguration;

  // Collect all eventHandlers to reattach them to the current used player
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[]; } = {};

  constructor(containerElement: HTMLElement, config: PlayerConfig, yospaceConfig: YospaceConfiguration = {}) {
    this.containerElement = containerElement;
    this.config = config;
    this.yospaceConfig = yospaceConfig;

    // To ensure proper transitions between the different players we need to create both at the beginning.
    // This will ensure the right position within the DOM (under the UI).
    this.bitmovinYospacePlayer = new InternalBitmovinYospacePlayer(containerElement, config, yospaceConfig) as any;

    // initialize bitmovin player
    Player.addModule(XMLModule);
    Player.addModule(StyleModule);
    Player.addModule(AdvertisingCoreModule);
    Player.addModule(AdvertisingBitmovinModule);
    Player.addModule(MSERendererModule);
    Player.addModule(EngineBitmovinModule);
    Player.addModule(HLSModule);
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
    Player.addModule(PolyfillModule);
    Player.addModule(AnalyticsModule);
    Player.addModule(EngineNativeModule);
    Player.addModule(DRMModule);
    Player.addModule(RemoteControlModule);
    this.bitmovinPlayer = new Player(containerElement, config);
    this.player = this.bitmovinYospacePlayer as any;

    this.wrapPlayer();
  }

  load(source: YospaceSourceConfig, forceTechnology?: string, disableSeeking?: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const switchPlayer = (toType: PlayerType) => {
        this.player.unload().then(() => {
          this.clearPlayerWrap(['load', 'wrapPlayer', 'clearPlayerWrap', 'eventHandlers', 'on', 'off', 'player', 'setPolicy']);

          const oldPlayer = this.player;
          if (toType === PlayerType.Bitmovin) {
            this.player = this.bitmovinPlayer;
          } else {
            this.player = this.bitmovinYospacePlayer as any;
          }

          this.currentPlayerType = toType;
          this.wrapPlayer();

          for (let eventType of Object.keys(this.eventHandlers) as PlayerEvent[]) {
            for (let eventCallback of this.eventHandlers[eventType]) {
              oldPlayer.off(eventType, eventCallback);
              this.player.on(eventType, eventCallback);
            }
          }

          this.player.load(source, forceTechnology, disableSeeking).then(resolve).catch(reject);
        }).catch(reject);
      };

      // Only switch player when necessary
      if (!source.assetType && this.currentPlayerType === PlayerType.BitmovinYospace) {
        switchPlayer(PlayerType.Bitmovin);
      } else if (source.assetType && this.currentPlayerType === PlayerType.Bitmovin) {
        switchPlayer(PlayerType.BitmovinYospace);
      } else {
        // Else load the source in the current player
        this.player.load(source, forceTechnology, disableSeeking).then(resolve).catch(reject);
      }
    });
  }

  on(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);

    this.player.on(eventType as any, callback);
  }

  off(eventType: PlayerEvent, callback: PlayerEventCallback): void {
    this.player.off(eventType, callback);
    ArrayUtils.remove(this.eventHandlers[eventType], callback);
  }

  // Since this is not in the PlayerAPI it will be gone when using the BitmovinPlayer so we need a custom implementation
  // here to ensure the feature during the live time of the BitmovinYospacePlayer
  setPolicy(policy: BitmovinYospacePlayerPolicy): void {
    if (this.getCurrentPlayerType() === PlayerType.Bitmovin) {
      console.log('[BitmovinYospacePlayer] Policy does not apply for Bitmovin Player but is saved for further ' +
        'BitmovinYospace Player usage');
    }

    this.bitmovinYospacePlayer.setPolicy(policy);
  }

  getCurrentPlayerType(): PlayerType {
    return this.currentPlayerType;
  }

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
        const propertyDescriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(this.player, property) ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.player), property);

        // If the property has getters/setters, wrap them accordingly...
        if (propertyDescriptor && (propertyDescriptor.get || propertyDescriptor.set)) {
          Object.defineProperty((this as any), property, {
            get: () => propertyDescriptor.get.call(this.player),
            set: (value: any) => propertyDescriptor.set.call(this.player, value),
            enumerable: true,
            configurable: true,
          });
        }
        // ... else just transfer the property to the wrapper
        else {
          (this as any)[property] = (<any>this.player)[property];
        }
      }
    }
  }

  private clearPlayerWrap(except: string[]) {
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

    for (const method of methods) {
      if (!except.includes(method)) {
        (this as any)[method] = undefined;
      }
    }

    for (const property of properties) {
      if (!except.includes(property)) {
        delete (this as any)[property];
      }
    }
  }
}
