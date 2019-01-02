import { ArrayUtils } from 'bitmovin-player-ui/dist/js/framework/arrayutils';

/** BYS -> BitmovinYospace */
export enum BYSListenerEvent {
  AD_BREAK_START = 'ad_break_start',
  ADVERT_START = 'advert_start',
  ADVERT_END = 'advert_end',
  AD_BREAK_END = 'ad_break_end',
  UPDATE_TIMELINE = 'update_timeline',
  ANALYTICS_FIRED = 'analytics_fired',
}

interface BYSListenerEventBase {
  type: BYSListenerEvent;
}

export interface BYSAdEvent extends BYSListenerEventBase {
  mediaId: string;
}

export interface BYSAdBreakEvent extends BYSListenerEventBase {
  adBreak: YSAdBreak;
}

export interface BYSUpdateTimelineEvent extends BYSListenerEventBase {
  timeline: YSTimeline;
}

export interface BYSAnalyticsFiredEvent extends BYSListenerEventBase {
  call_id: any;
  call_data: any;
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
  private listeners: { [eventType: string]: BYSListenerCallbackFunction[]; } = {};

  addListener(event: BYSListenerEvent, callback: BYSListenerCallbackFunction): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);
  }

  removeListener(event: BYSListenerEvent, callback: BYSListenerCallbackFunction): void {
    ArrayUtils.remove(this.listeners[event], callback);
  }

  AdBreakStart(brk: YSAdBreak): void {
    this.emitEvent({
      type: BYSListenerEvent.AD_BREAK_START,
      adBreak: brk,
    } as BYSAdBreakEvent);
  }

  AdvertStart(mediaId: string): void {
    this.emitEvent({
      type: BYSListenerEvent.ADVERT_START,
      mediaId: mediaId,
    } as BYSAdEvent);
  }

  AdvertEnd(mediaId: string): void {
    this.emitEvent({
      type: BYSListenerEvent.ADVERT_END,
      mediaId: mediaId,
    } as BYSAdEvent);
  }

  AdBreakEnd(brk: YSAdBreak): void {
    this.emitEvent({
      type: BYSListenerEvent.AD_BREAK_END,
      adBreak: brk,
    } as BYSAdBreakEvent);
  }

  UpdateTimeline(timeline: YSTimeline): void {
    console.log('[listener] UpdateTimeline', timeline);
    this.emitEvent({
      type: BYSListenerEvent.UPDATE_TIMELINE,
      timeline: timeline,
    } as BYSUpdateTimelineEvent);
  }

  AnalyticsFired(call_id: any, call_data: any): void {
    console.log('[listener] AnalyticsFired', call_id, call_data);
    this.emitEvent({
      type: BYSListenerEvent.ANALYTICS_FIRED,
      call_id: call_id,
      call_data: call_data,
    } as BYSAnalyticsFiredEvent);
  }

  private emitEvent(event: BYSListenerEventBase) {
    if (this.listeners[event.type]) {
      for (let callback of this.listeners[event.type]) {
        callback(event);
      }
    }
  }
}
