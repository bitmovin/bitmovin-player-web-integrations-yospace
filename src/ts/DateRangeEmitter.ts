import { MetadataEvent, PlayerAPI, TimeChangedEvent } from 'bitmovin-player';
import { Logger } from './Logger';

export class DateRangeEmitter {
  private player: PlayerAPI;
  private _manager: YSSessionManager;
  private emsgEvents: any[] = [];
  private processedDateRangeEvents: {[key: string]: number};

  constructor(player: PlayerAPI) {
    this.player = player;
    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
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
      if (previousDateRange && (Math.abs(previousDateRange - event.start) < 10)) {
        Logger.log('DateRangeEmitter - Duplicate DateRange detected ymid=' + dateRangeData.clientAttributes.comYospaceYmid + 'currentTime=' + this.player.getCurrentTime());
        return;
      } else {
        this.processedDateRangeEvents[dateRangeData.clientAttributes.comYospaceYmid] = event.start;
        Logger.log('DateRangeEmitter - currentTime=' + this.player.getCurrentTime() + ' metadata=' + JSON.stringify(event));
      }

      // create an S metadata event 0.1 seconds into the start of the EXT-X-DATERANGE
      let metadataStart = {
        'startTime': String(event.start + 0.1),
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
          'startTime': String(event.start + val),
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
        'startTime': String(event.end - 0.1),
        'YMID': dateRangeData.clientAttributes.comYospaceYmid,
        'YSCP': dateRangeData.clientAttributes.comYospaceYmid,
        'YSEQ': '1:1',
        'YTYP': 'E',
        'YDUR': '2',
      };

      this.emsgEvents.push(metadataEnd);
    }
  };

  private onTimeChanged = (event: TimeChangedEvent): void => {
    // Logger.log('DateRangeEmitter - TimeChanged ' + JSON.stringify(event));
    while (this.emsgEvents.length > 0 && this.emsgEvents[0].startTime <= event.absoluteTime) {
      let emsg = this.emsgEvents.shift();
      Logger.log('[DateRangeEmitter] Sending: ' + event.absoluteTime + ' emsg: ' + JSON.stringify(emsg));
      if (this.manager) {
        this.manager.reportPlayerEvent(YSPlayerEvents.METADATA, emsg);
      }
    }
  };
}