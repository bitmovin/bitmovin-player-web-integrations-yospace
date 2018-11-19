import {
  BitmovinYospacePlayer,
} from "./YoSpaceAdManagement";

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
    // TODO: check if an ad is played currently
    return true;
  }

  canSeekTo(seekTarget: number): number {
    // TODO: do not allow seeking over ads
    // TODO: (To enable we need closest ad in future -> seek to / play it -> seek to original target)
    return seekTarget;
  }

  canSkip(): number {
    // TODO: get current ad and return skippOffset
    return 0;
  }

  canMute(): boolean {
    return true;
  }

  canPause(): boolean {
    return true;
  }
}
