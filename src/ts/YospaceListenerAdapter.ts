import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';
import { Logger } from './Logger';

import { YSAdvert, YSAdBreak } from './Yospace';

/** BYS -> BitmovinYospace */
export enum BYSListenerEvent {
  AD_BREAK_START = 'ad_break_start',
  ADVERT_START = 'advert_start',
  ADVERT_END = 'advert_end',
  AD_BREAK_END = 'ad_break_end',
  ANALYTICS_FIRED = 'analytics_fired',
}

export type BYSTrackingEventType =
  | 'loaded'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'pause'
  | 'resume'
  | 'rewind'
  | 'skip'
  | 'playerExpand'
  | 'playerCollapse'
  | 'ClickTracking'
  | 'acceptInvitation';

interface BYSListenerEventBase {
  type: BYSListenerEvent;
}

export interface BYSAdEvent extends BYSListenerEventBase {
  ad: YSAdvert;
}

export interface BYSAdBreakEvent extends BYSListenerEventBase {
  adBreak: YSAdBreak;
}

export interface BYSAnalyticsFiredEvent extends BYSListenerEventBase {
  call_id: BYSTrackingEventType;
}

interface BYSListenerCallbackFunction {
  (event: BYSListenerEventBase): void;
}

/**
 * Adapter for the listener passed to Yospace.
 * The default way would be to pass an object to Yospace with the structure of this class.
 * To simplify the Yospace callbacks handling this Adapter was introduced.
 */
export class YospaceAdListenerAdapter {
  private listeners: { [eventType: string]: BYSListenerCallbackFunction[] } = {};

  addListener(event: BYSListenerEvent, callback: BYSListenerCallbackFunction): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);
  }

  removeListener(event: BYSListenerEvent, callback: BYSListenerCallbackFunction): void {
    ArrayUtils.remove(this.listeners[event], callback);
  }

  onAdvertBreakStart(brk: YSAdBreak): void {
    this.emitEvent({
      type: BYSListenerEvent.AD_BREAK_START,
      adBreak: brk,
    } as BYSAdBreakEvent);
  }

  onAdvertStart(ad: YSAdvert): void {
    this.emitEvent({
      type: BYSListenerEvent.ADVERT_START,
      ad: ad,
    } as BYSAdEvent);
  }

  onAdvertEnd(): void {
    this.emitEvent({
      type: BYSListenerEvent.ADVERT_END,
    } as BYSAdEvent);
  }

  onAdvertBreakEnd(): void {
    this.emitEvent({
      type: BYSListenerEvent.AD_BREAK_END,
    } as BYSAdBreakEvent);
  }

  onAnalyticUpdate() {
    // No op
  }

  onTrackingEvent(type: BYSTrackingEventType) {
    Logger.log('[listener] AnalyticsFired', type);
    const event: BYSAnalyticsFiredEvent = {
      type: BYSListenerEvent.ANALYTICS_FIRED,
      call_id: type,
    };

    this.emitEvent(event);
  }

  private emitEvent(event: BYSListenerEventBase) {
    if (this.listeners[event.type]) {
      for (const callback of this.listeners[event.type]) {
        callback(event);
      }
    }
  }
}
