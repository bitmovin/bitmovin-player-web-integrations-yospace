import { BitmovinYospacePlayer, } from "./YoSpaceAdManagement";
import { Ad, AdBreak, AdEvent, LinearAd, PlayerEvent } from "bitmovin-player";

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
    return this.player.ads.getActiveAd() === undefined;
  }

  canSeekTo(seekTarget: number): number {
    // TODO: do not allow seeking over ads
    // TODO: (To enable we need closest ad in future -> seek to / play it -> seek to original target)
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
