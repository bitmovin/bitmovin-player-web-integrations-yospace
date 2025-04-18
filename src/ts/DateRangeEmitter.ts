import { AdEvent, MetadataEvent, PlayerAPI, TimeChangedEvent, PlayerEventBase, MetadataType, MetadataParsedEvent } from 'bitmovin-player';
import { Logger } from './Logger';
import { YospacePlayerEventCallback } from './BitmovinYospacePlayerAPI';
import { YospaceLinearAd } from './InternalBitmovinYospacePlayer';
import stringify from 'fast-safe-stringify';
import { Session } from '@yospace/admanagement-sdk';

interface YsMetadata {
  startTime: string;
  YMID: string;
  YSCP: string;
  YSEQ: string;
  YTYP: string;
  YDUR: string;
}

export class DateRangeEmitter {
  private player: PlayerAPI;
  private eventHandlers: { [eventType: string]: YospacePlayerEventCallback[] };
  private _session: Session | null;
  private emsgEvents: YsMetadata[];
  private processedDateRangeEvents: { [key: string]: number };

  constructor(player: PlayerAPI, eventHandlers: { [eventType: string]: YospacePlayerEventCallback[] } = {}) {
    this.player = player;

    this.eventHandlers = eventHandlers;

    this._session = null;
    this.emsgEvents = [];
    this.processedDateRangeEvents = {};

    this.player.on(this.player.exports.PlayerEvent.Metadata, this.onMetadata);
    this.player.on(this.player.exports.PlayerEvent.TimeChanged, this.onTimeChanged);
    this.player.on(this.player.exports.PlayerEvent.AdStarted, this.onAdStarted);
    this.player.on(this.player.exports.PlayerEvent.AdFinished, this.onAdFinished);
    this.player.on(this.player.exports.PlayerEvent.AdBreakStarted, this.onAdBreakStarted);
    this.player.on(this.player.exports.PlayerEvent.AdBreakFinished, this.onAdBreakFinished);
  }

  get session(): Session | null {
    return this._session;
  }

  set session(value: Session | null) {
    this._session = value;
  }

  reset(): void {
    this._session = null;
    this.emsgEvents = [];
    this.processedDateRangeEvents = {};
  }

  private onMetadata = (event: PlayerEventBase): void => {
    const metadataEvent = event as MetadataEvent;

    if (metadataEvent.metadataType === 'DATERANGE') {
      const dateRangeData: any = metadataEvent.metadata;
      const previousDateRange: number = this.processedDateRangeEvents[dateRangeData.clientAttributes.comYospaceYmid];
      const startTime = metadataEvent.start;
      const currentTime = this.player.getCurrentTime();

      if (typeof startTime === 'number') {
        // check for duplicate due to a bug in the Bitmovin Player that fires duplicate date range tags
        if (previousDateRange && Math.abs(previousDateRange - startTime) < 10) {
          Logger.log(
            '[BitmovinYospacePlayer] - Duplicate DateRange detected ymid=' +
              dateRangeData.clientAttributes.comYospaceYmid +
              'currentTime=' +
              this.player.getCurrentTime(),
          );
          return;
        } else {
          this.processedDateRangeEvents[dateRangeData.clientAttributes.comYospaceYmid] = startTime;
          Logger.log('[BitmovinYospacePlayer] - currentTime=' + this.player.getCurrentTime() + ' metadata=' + stringify(metadataEvent));
        }
      }

      // create an S metadata event 0.1 seconds into the start of the EXT-X-DATERANGE
      const metadataStart: YsMetadata = {
        startTime: String(currentTime + 0.1),
        YMID: dateRangeData.clientAttributes.comYospaceYmid,
        YSCP: dateRangeData.clientAttributes.comYospaceYmid,
        YSEQ: '1:1',
        YTYP: 'S',
        YDUR: '0.1',
      };

      this.emsgEvents.push(metadataStart);
      let val = 2.1;
      const duration = dateRangeData.duration;

      // create M metadata events every 2 seconds throughout the asset
      while (val <= duration) {
        const metadataMid: YsMetadata = {
          startTime: String(currentTime + val),
          YMID: dateRangeData.clientAttributes.comYospaceYmid,
          YSCP: dateRangeData.clientAttributes.comYospaceYmid,
          YSEQ: '1:1',
          YTYP: 'M',
          YDUR: String(val),
        };
        val = val + 2;
        this.emsgEvents.push(metadataMid);
      }

      // create the E event 0.1 seconds before the end of the EXT-X-DATERANGE
      const metadataEnd: YsMetadata = {
        startTime: String(currentTime + duration - 0.1),
        YMID: dateRangeData.clientAttributes.comYospaceYmid,
        YSCP: dateRangeData.clientAttributes.comYospaceYmid,
        YSEQ: '1:1',
        YTYP: 'E',
        YDUR: String(duration - 0.1),
      };

      this.emsgEvents.push(metadataEnd);

      Logger.log('[BitmovinYospacePlayer] DateRange events which will be sent during upcoming break:');
      Logger.table(
        this.emsgEvents.map(({ startTime, YTYP, YDUR }) => {
          return { Type: YTYP, 'Start Time': startTime, Duration: YDUR };
        }),
      );

      this.emitMetadataParsedEvents(metadataEvent.timestamp);
    }
  };

  private onTimeChanged = (event: PlayerEventBase): void => {
    const timeChangedEvent = event as TimeChangedEvent;

    while (this.emsgEvents.length > 0 && parseFloat(this.emsgEvents[0].startTime) <= timeChangedEvent.time) {
      const emsg = this.emsgEvents.shift();
      if (!emsg) {
        return;
      }

      Logger.log(
        '[BitmovinYospacePlayer] Sending: timestamp=' +
          timeChangedEvent.timestamp +
          ' currentTime=' +
          timeChangedEvent.time +
          ' emsg: ' +
          stringify(emsg),
      );

      this.emitMetadataEvent(timeChangedEvent.timestamp, emsg);

      if (this.session) {
        emsg.startTime = '';
        this.session.onTimedMetadata(emsg);
      }
    }
  };

  private emitMetadataParsedEvents(timestamp: number) {
    this.emsgEvents.forEach((event) => {
      const emsg = Object.assign({}, event);

      const metadataParsedEvent = this.createBitmovinEvent(timestamp, emsg) as MetadataParsedEvent;
      metadataParsedEvent.data = metadataParsedEvent.metadata;
      metadataParsedEvent.type = this.player.exports.PlayerEvent.MetadataParsed;

      this.fireEvent(metadataParsedEvent);
    });
  }

  private emitMetadataEvent(timestamp: number, emsg: any) {
    const metadataEvent = this.createBitmovinEvent(timestamp, emsg);

    this.fireEvent(metadataEvent);
  }

  private createBitmovinEvent(timestamp: number, emsg: any) {
    const startTime = Number(emsg.startTime);

    delete emsg.startTime;
    const metadataString = Object.keys(emsg)
      .map((key) => `${key}=${emsg[key]}`)
      .join(',');

    const result: MetadataEvent = {
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

  private onAdStarted = (event: PlayerEventBase): void => {
    const adEvent = event as AdEvent;

    const yospaceAd = adEvent.ad as YospaceLinearAd;
    Logger.log('[BitmovinYospacePlayer] Ad Started for id=' + stringify(yospaceAd));

    // if we are not a VPAID ad
    if (!yospaceAd.uiConfig?.requestsUi) {
      while (this.emsgEvents.length > 0 && (this.emsgEvents[0].YTYP === 'M' || this.emsgEvents[0].YTYP === 'E')) {
        const emsg = this.emsgEvents.shift();
        Logger.log('[BitmovinYospacePlayer] Removing emsg due to VPAID starting: ' + stringify(emsg));
      }
    }
  };

  private onAdFinished = (): void => {
    Logger.log('[BitmovinYospacePlayer] Ad Finished');
  };

  private onAdBreakStarted = (): void => {
    Logger.log('[BitmovinYospacePlayer] Ad Break Started');
  };

  private onAdBreakFinished = (): void => {
    Logger.log('[BitmovinYospacePlayer] Ad Break Finished');
  };

  private fireEvent<E extends PlayerEventBase>(event: E): void {
    if (this.eventHandlers[event.type]) {
      this.eventHandlers[event.type].forEach((callback: YospacePlayerEventCallback) => callback(event));
    }
  }
}
