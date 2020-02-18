import { AdBreakEvent, AdEvent, MetadataEvent, PlayerAPI, TimeChangedEvent } from 'bitmovin-player';
import { Logger } from './Logger';
import { YospaceLinearAd } from './InternalBitmovinYospacePlayer';
import stringify from 'fast-safe-stringify';

export class DateRangeEmitter {
  private player: PlayerAPI;
  private _manager: YSSessionManager;
  private emsgEvents: any[] = [];
  private processedDateRangeEvents: { [key: string]: number };
  private currentTimeBase: number = 0;

  constructor(player: PlayerAPI) {
    this.player = player;
    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.AdStarted, this.onAdStarted);
    this.player.on(this.player.exports.PlayerEvent.AdFinished, this.onAdFinished);
    this.player.on(this.player.exports.PlayerEvent.AdBreakStarted, this.onAdBreakStarted);
    this.player.on(this.player.exports.PlayerEvent.AdBreakFinished, this.onAdBreakFinished);
  }

  get manager(): YSSessionManager {
    return this._manager;
  }

  set manager(value: YSSessionManager) {
    this._manager = value;
  }

  reset(): void {
    this._manager = null;
    this.emsgEvents = [];
    this.processedDateRangeEvents = {};
  }

  private onMetadata = (event: MetadataEvent): void => {
    if (event.metadataType === 'DATERANGE') {
      let dateRangeData: any = event.metadata;
      let previousDateRange: number = this.processedDateRangeEvents[dateRangeData.clientAttributes.comYospaceYmid];
      let startTime = event.start;
      let currentTime = this.player.getCurrentTime();

      // check for duplicate due to a bug in the Bitmovin Player that fires duplicate date range tags
      if (previousDateRange && (Math.abs(previousDateRange - startTime) < 10)) {
        Logger.log(
          '[BitmovinYospacePlayer] - Duplicate DateRange detected ymid=' + dateRangeData.clientAttributes.comYospaceYmid
          + 'currentTime=' + this.player.getCurrentTime());
        return;
      } else {
        this.processedDateRangeEvents[dateRangeData.clientAttributes.comYospaceYmid] = startTime;
        Logger.log(
          '[BitmovinYospacePlayer] - currentTime=' + this.player.getCurrentTime() + ' metadata=' + stringify(
          event));
      }

      // create an S metadata event 0.1 seconds into the start of the EXT-X-DATERANGE
      let metadataStart = {
        'startTime': String(currentTime + 0.1),
        'YMID': dateRangeData.clientAttributes.comYospaceYmid,
        'YSCP': dateRangeData.clientAttributes.comYospaceYmid,
        'YSEQ': '1:1',
        'YTYP': 'S',
        'YDUR': '0.1',
      };

      this.emsgEvents.push(metadataStart);
      let val = 2.1;
      let duration = dateRangeData.duration;

      // create M metadata events every 2 seconds throughout the asset
      while (val <= duration) {
        let metadataMid = {
          'startTime': String(currentTime + val),
          'YMID': dateRangeData.clientAttributes.comYospaceYmid,
          'YSCP': dateRangeData.clientAttributes.comYospaceYmid,
          'YSEQ': '1:1',
          'YTYP': 'M',
          'YDUR': String(val),
        };
        val = val + 2;
        this.emsgEvents.push(metadataMid);
      }

      // create the E event 0.1 seconds before the end of the EXT-X-DATERANGE
      let metadataEnd = {
        'startTime': String(currentTime + duration - 0.1),
        'YMID': dateRangeData.clientAttributes.comYospaceYmid,
        'YSCP': dateRangeData.clientAttributes.comYospaceYmid,
        'YSEQ': '1:1',
        'YTYP': 'E',
        'YDUR': String(duration - 0.1),
      };

      this.emsgEvents.push(metadataEnd);
    }
  };

  private onTimeChanged = (event: TimeChangedEvent): void => {
    // Logger.log('[BitmovinYospacePlayer] - TimeChanged ' + stringify(event));

    while (this.emsgEvents.length > 0 && this.emsgEvents[0].startTime <= event.time) {
      let emsg = this.emsgEvents.shift();

      Logger.log('[BitmovinYospacePlayer] Sending: timestamp=' + event.timestamp + ' currentTime=' + event.time
        + ' absoluteTime=' + event.absoluteTime + ' emsg: ' + stringify(emsg));
      if (this.manager) {
        emsg.startTime = '';
        this.manager.reportPlayerEvent(YSPlayerEvents.METADATA, emsg);
      }
    }
  };

  private onAdStarted = (event: AdEvent): void => {
    let yospaceAd = event.ad as YospaceLinearAd;
    Logger.log('[BitmovinYospacePlayer] Ad Started for id=' + stringify(yospaceAd));

    // if we are not a VPAID ad
    if (!yospaceAd.uiConfig.requestsUi) {
      while (this.emsgEvents.length > 0 && (this.emsgEvents[0].YTYP === 'M' || this.emsgEvents[0].YTYP === 'E')) {
        let emsg = this.emsgEvents.shift();
        Logger.log('[BitmovinYospacePlayer] Removing emsg due to VPAID starting: ' + stringify(emsg));
      }
    }
  };

  private onAdFinished = (event: AdEvent): void => {
    let yospaceAd = event.ad as YospaceLinearAd;
    Logger.log('[BitmovinYospacePlayer] Ad Finished for id');
  };

  private onAdBreakStarted = (event: AdBreakEvent): void => {
    Logger.log('[BitmovinYospacePlayer] Ad Break Started for id');
  };

  private onAdBreakFinished = (event: AdBreakEvent): void => {
    Logger.log('[BitmovinYospacePlayer] Ad Break Finished for id');
  };

}