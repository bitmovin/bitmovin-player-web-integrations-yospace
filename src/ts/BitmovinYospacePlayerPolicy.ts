import { BitmovinYospacePlayer, } from "./YospaceAdManagement";
import { LinearAd } from "bitmovin-player";

export interface BitmovinYospacePlayerPolicy {
  canMute(): boolean;
  canSeek(): boolean;
  /**
   * Determine whether the player is permitted to seek to a point in the stream.
   * Based on the provided location, the nearest permissible location is returned which should be
   * used by the player to override the viewers chosen seek location.
   * This provides the ability to prevent skipping over adverts.
   * @param seekTarget
   * @return The closest available seek target. Default start time of last ad which would be skipped.
   */
  canSeekTo(seekTarget: number): number;
  /**
   * @return 0+ if skip is permitted
   * the value is the delay in seconds before skip is permitted, otherwise -1 which means the advert is not skippable
   */
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
    const adBreaks = this.player.ads.list();

    const skippedAdBreaks = adBreaks.filter(adBreak => {
      return adBreak.scheduleTime > currentTime && adBreak.scheduleTime < seekTarget;
    });

    if (skippedAdBreaks.length > 0) {
      const adBreakToPlay = skippedAdBreaks[skippedAdBreaks.length - 1];
      return adBreakToPlay.scheduleTime;
    }

    return seekTarget;
  }

  canSkip(): number {
    const currentAd = this.player.ads.getActiveAd();
    if (currentAd && currentAd.isLinear && !this.player.isLive()) {
      const currentTime = this.player.getCurrentTime();
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
