import { PlayerAPI, PlayerConfig, SourceConfig } from 'bitmovin-player';

interface YoSpaceSourceConfig extends SourceConfig {
  // TODO: check whats needed here
}

export class BitmovinYoSpacePlayer {
  constructor();
  // constructor(config?: PlayerConfig);
  constructor(player?: PlayerAPI, config?: PlayerConfig) {
    if (player.getSource() !== null) {
      throw 'Player must not load a source!';
    }

    // TODO: create player if not passed into

    // TODO: wrap player (only what don't need to be validated) (hard coded?)

    // TODO: YoSpace SDK

    // TODO: YoSpace Validator

  }

  // TODO: Event Handling
}