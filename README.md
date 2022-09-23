# Bitmovin Player Yospace Integration

This integration completely encapsulates the usage of Yospace. After creating the player it can be used like a normal [Bitmovin Player](https://bitmovin.com/docs/player) instance.

## Usage

### Sample Apps
1. Following the instructions on [Yospace Developer 6.4 Step 1](https://developer.yospace.com/sdk-documentation/javascript/userguide/latest/en/downloads.html#running-a-sample-app) to add Yospace's private npm registry to your setup
2. Run `npm install`
3. Run `npm start`

### Basic Setup

#### With NPM

1. Install the Yospace Ad Management SDK: `npm i -S @yospace/admanagement-sdk`
   - Hint: Yospace uses a private NPM registry and you need log in credentials provided by Yospace. Please refer to the [Yospace Developer docs](https://developer.yospace.com/sdk-documentation/javascript/userguide/latest/en/downloads.html#running-a-sample-app) for details.
2. Install the Bitmovin Player Yospace Integration: `npm i -S @bitmovin/player-integration-yospace`
3. Import the `BitmovinYospacePlayer` into your code: `import { BitmovinYospacePlayer } from '@bitmovin/player-integration-yospace';`
4. Import the Bitmovin `Player` core into your code: `import { Player } from 'bitmovin-player/modules/bitmovinplayer-core';`
5. Add the relevant Bitmovin Player modules to the `Player` object using the static `Player.addModule(...)` API
6. Create a new player instance, and pass the BitmovinPlayerStaticAPI to it: `new BitmovinYospacePlayer(Player, container, config)`
7. Load a `YospaceSourceConfig` with your Yospace HLS URL. It's a `PlayerConfig` with Yospace-specific extension. Most important extension is the `assetType`, which needs to be set.

```ts
const playerConfig: PlayerConfig = {
  key: 'YOUR-PLAYER-KEY',
};

const playerContainer = document.getElementById('player');
const bitmovinYospacePlayer = new BitmovinYospacePlayer(Player, playerContainer, playerConfig);

// Create the UI afterwards (see https://github.com/bitmovin/bitmovin-player-ui for details)
const uiManager = UIFactory.buildDefaultUI(player);

// Load a new yospace source
const source: YospaceSourceConfig = {
  hls: 'your yospace url',

  // The type of the asset, can be imported: `import { YospaceAssetType } from '@bitmovin/player-integration-yospace';`
  assetType: YospaceAssetType.VOD,
  // one of:
  // - bitmovin.player.ads.yospace.YospaceAssetType.LINEAR
  // - bitmovin.player.ads.yospace.YospaceAssetType.VOD
};

bitmovinYospacePlayer.load(source);
```

### Advanced Setup

#### Policy

As there can be different rules for different use-cases we provide a `BitmovinYospacePlayerPolicy` interface which can be implemented.
In this policy you can define which actions should be allowed during playback.

You can set the policy right after initialization by calling:

```js
bitmovinYospacePlayer.setPolicy(...); // pass in your policy object which implements BitmovinYospacePlayerPolicy
```

We also provide a default policy.  
See [BitmovinYospacePlayerPolicy](./src/ts/BitmovinYospacePlayerPolicy.ts) for more details.

#### Config

You can pass a third optional parameter to the player constructor:

```js
const yospaceConfig: YospaceConfiguration = {
  debug: true,
};
// ...
const bitmovinYospacePlayer = new BitmovinYospacePlayer(Player, playerContainer, conf, yospaceConfig);
```

### Tizen

#### Tizen Config

- Include the following Tweaks to the PlayerConfig:

```
tweaks: {
    ...
    file_protocol : true, // Required if app is being loaded from file system
    app_id : "Ff4zhu5kqV.TizenBitmovinPlayerAppMode" // this Tizen App Id should also be allow-listed in Player License and optionally, Analytics License
}
```

- Make sure the app_id is allow-listed in your Player's License
- In the `YospaceConfig` set the param `YospaceConfig.disableServiceWorker` to `true`
- In the `YospaceConfig` set the param `YospaceConfig.useTizen` to `true`

```ts
// Yospace configuration
const yospaceConfig = {
    ...
    disableServiceWorker: true, // Disable Service Worker for Tizen Web App use
    useTizen: true,
};
```

#### Tizen Demo

- Run `npm run build-tv`
- Import the Tizen folder(as General -> Existing Project) into your Tizen Studio and run as a Tizen Web Application

## Limitations

- No support for ad tracking during live streams in Safari if EMSG tags are used. (EMSG tags are not supported by Safari)
- Only HLS is supported at this point, no DASH support.

## Development, Contribution, Releases

### Set up environment

1. Use node.js version specified in `.nvmrc`
2. Set up your access to the private npm registry of Yospace
3. Run `npm ci`
4. Use `npm run start` to run a webpack dev server

### Branching & Releasing

- This repo uses git-flow and semantic versioning
- PRs should be made against `develop` branch
- PRs should always contain an update of the [CHANGELOG.md](CHANGELOG.md) file
- New versions will be manually released into the `main` branch and tagged there
- Tagged versions will be manually published to [npm](https://www.npmjs.com/package/@bitmovin/player-integration-yospace)

### Principles

- The Bitmovin Player shall not be packaged into the JS file created by the build of this integration. To achieve this, types can be imported and used, but no code must be imported/used (including string enums!)
