import { PlayerEvent } from "bitmovin-player";
import { BitmovinYospacePlayer } from "./YospaceAdManagement";

export class YospaceAdListener {
  private player: BitmovinYospacePlayer;

  constructor(player: BitmovinYospacePlayer) {
    this.player = player;
  }

  AdBreakStart(brk: YSAdBreak): void {
    let event = AdEventsFactory.createAdBreakEvent(brk, this.player.getCurrentTime(), PlayerEvent.AdBreakStarted);
    this.player.fireEvent(event);
  }

  AdvertStart(mediaId: string): void {
    let event = AdEventsFactory.createAdEvent(this.player.getCurrentTime(), PlayerEvent.AdStarted);
    this.player.fireEvent(event);
  }

  AdvertEnd(mediaId: string): void {
    let event = AdEventsFactory.createAdEvent(this.player.getCurrentTime(), PlayerEvent.AdFinished);
    this.player.fireEvent(event);
  }

  AdBreakEnd(brk: YSAdBreak): void {
    let event = AdEventsFactory.createAdBreakEvent(brk, this.player.getCurrentTime(), PlayerEvent.AdBreakFinished);
    this.player.fireEvent(event);
  }

  UpdateTimeline(timeline: any): void {
    console.log('[listener] UpdateTimeline', timeline);
    // TODO: find out what this is
  }
  AnalyticsFired(call_id: any, call_data: any): void {
    console.log('[listener] AnalyticsFired', call_id, call_data);
    // TODO: track analytics
  }
}

class AdEventsFactory {
  static createAdBreakEvent(adBreak: YSAdBreak, timestamp: number, type: PlayerEvent) {
    return {
      timestamp: timestamp,
      type: type,
      adBreak: {
        scheduleTime: adBreak.startPosition
      }
    };
  }

  static createAdEvent(timestamp: number, type: PlayerEvent) {
    return {
      timestamp: timestamp,
      type: type,
      ad: {
        isLinear: true,
      }
    };
  }
}
