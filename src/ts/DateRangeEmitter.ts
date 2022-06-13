import { AdBreakEvent, AdEvent, MetadataEvent, PlayerAPI, TimeChangedEvent, PlayerEventBase, MetadataType, MetadataParsedEvent } from 'bitmovin-player';
import { Logger } from './Logger';
import { YospacePlayerEventCallback } from './BitmovinYospacePlayerAPI';
import { YospaceLinearAd } from './InternalBitmovinYospacePlayer';
import stringify from 'fast-safe-stringify';

export class DateRangeEmitter {
  private player: PlayerAPI;
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[]; } = {};
  private _session: YSSession;
  private emsgEvents: any[] = [];
  private processedDateRangeEvents: { [key: string]: number };
  private currentTimeBase: number = 0;

  constructor(player: PlayerAPI, eventHandlers?: { [eventType: string]: YospacePlayerEventCallback[]; }) {
    this.player = player;
    this.eventHandlers = eventHandlers;

    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.AdStarted, this.onAdStarted);
    this.player.on(this.player.exports.PlayerEvent.AdFinished, this.onAdFinished);
    this.player.on(this.player.exports.PlayerEvent.AdBreakStarted, this.onAdBreakStarted);
    this.player.on(this.player.exports.PlayerEvent.AdBreakFinished, this.onAdBreakFinished);
  }

  get session(): YSSession {
    return this._session;
  }

  set session(value: YSSession) {
    this._session = value;
  }

  reset(): void {
    this._session = null;
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

      Logger.log('[BitmovinYospacePlayer] DateRange events which will be sent during upcoming break:');
      Logger.table(this.emsgEvents.map(({ startTime, YTYP, YDUR }) => {
        return { 'Type': YTYP, 'Start Time': startTime, 'Duration': YDUR };
      }));

      this.emitMetadataParsedEvents(event.timestamp);
    }
  };

  private onTimeChanged = (event: TimeChangedEvent): void => {
    while (this.emsgEvents.length > 0 && this.emsgEvents[0].startTime <= event.time) {
      let emsg = this.emsgEvents.shift();

      Logger.log('[BitmovinYospacePlayer] Sending: timestamp=' + event.timestamp + ' currentTime=' + event.time
        + ' absoluteTime=' + event.absoluteTime + ' emsg: ' + stringify(emsg));

      this.emitMetadataEvent(event.timestamp, emsg);

      if (this.session) {
        emsg.startTime = '';
        this.session.onTimedMetadata(emsg);
      }
    }
  };

  private emitMetadataParsedEvents(timestamp: number) {
    this.emsgEvents.forEach(event => {
      let emsg = Object.assign({}, event);

      let metadataParsedEvent = this.createBitmovinEvent(timestamp, emsg) as MetadataParsedEvent;
      metadataParsedEvent.data = metadataParsedEvent.metadata;
      metadataParsedEvent.type = this.player.exports.PlayerEvent.MetadataParsed;

      this.fireEvent(metadataParsedEvent);
    });
  }

  private emitMetadataEvent(timestamp: number, emsg: any) {
    let metadataEvent = this.createBitmovinEvent(timestamp, emsg);

    this.fireEvent(metadataEvent);
  }

  private createBitmovinEvent(timestamp: number, emsg: any) {
    const startTime: number = Number(emsg.startTime);

    delete emsg.startTime;
    let metadataString = Object.keys(emsg).map((key) => `${key}=${emsg[key]}`).join(',');

    let result: MetadataEvent = {
      metadataType: 'ID3' as MetadataType,
      type: this.player.exports.PlayerEvent.Metadata,
      metadata: {
        messageData: metadataString,
      },
      timestamp: timestamp,
      start: startTime,
    };

    return result;
  }

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

  private fireEvent<E extends PlayerEventBase>(event: E): void {
    if (this.eventHandlers[event.type]) {
      this.eventHandlers[event.type].forEach((callback: YospacePlayerEventCallback) => callback(event));
    }
  }
}
