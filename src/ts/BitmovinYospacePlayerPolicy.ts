import { BitmovinYospacePlayer, } from "./YospaceAdManagement";
import { LinearAd } from "bitmovin-player";

export interface BitmovinYospacePlayerPolicy {
  canMute(): boolean;
  canSeek(): boolean;
  canSeekTo(seekTarget: number): number;
  canSkip(): number;
  canPause(): boolean;
}

export class DefaultBitmovinYospacePlayerPolicy implements BitmovinYospacePlayerPolicy {
  private player: BitmovinYospacePlayer;

  constructor(player: BitmovinYospacePlayer) {
    this.player = player;
  }

  canSeek(): boolean {
    // allow only seeking if no add is playing
    return !this.player.ads.getActiveAd();
  }

  canSeekTo(seekTarget: number): number {
    const currentTime = this.player.getCurrentTime();
    let adBreaks = this.player.ads.list();

    let skippedAdBreaks = adBreaks.filter(adBreak => {
      return adBreak.scheduleTime > currentTime && adBreak.scheduleTime < seekTarget;
    });

    if (skippedAdBreaks.length > 0) {
      let adBreakToPlay = skippedAdBreaks[skippedAdBreaks.length - 1];
      return adBreakToPlay.scheduleTime;
    }

    return seekTarget;
  }

  canSkip(): number {
    let currentAd = this.player.ads.getActiveAd();
    if (currentAd && currentAd.isLinear) {
      let currentTime = this.player.getCurrentTime();
      if ((currentAd as LinearAd).skippableAfter < 0) {
        return -1;
      }

      if (currentTime >= (currentAd as LinearAd).skippableAfter) {
        return 0;
      } else {
        return (currentAd as LinearAd).skippableAfter - currentTime;
      }
    }

    return -1;
  }

  canMute(): boolean {
    return true;
  }

  canPause(): boolean {
    return true;
  }
}
