import { LinearAd } from 'bitmovin-player';
import { BitmovinYospacePlayerAPI, BitmovinYospacePlayerPolicy } from './BitmovinYospacePlayerAPI';

export class DefaultBitmovinYospacePlayerPolicy implements BitmovinYospacePlayerPolicy {
  private player: BitmovinYospacePlayerAPI;

  constructor(player: BitmovinYospacePlayerAPI) {
    this.player = player;
  }

  canSeek(): boolean {
    // allow only seeking if no ad is playing
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

  canChangePlaybackSpeed(): boolean {
    return !Boolean(this.player.ads.getActiveAd());
  }
}
