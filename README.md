# Bitmovin Player Yospace Integration

This is an open-source project to enable the use of a third-party component (Yospace) with the Bitmovin Player Web SDK.

## Maintenance and Update

This project is not part of a regular maintenance or update schedule. For any update requests, please take a look at the guidance further below.

## Contributions to this project

As an open-source project, we are pleased to accept any and all changes, updates and fixes from the community wishing to use this project. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for more details on how to contribute.

## Reporting player bugs

If you come across a bug related to the player, please raise this through your support ticketing system.

## Need more help?

Should you want some help updating this project (update, modify, fix or otherwise) and can't contribute for any reason, please raise your request to your Bitmovin account team, who can discuss your request.

## Support and SLA Disclaimer

As an open-source project and not a core product offering, any request, issue or query related to this project is excluded from any SLA and Support terms that a customer might have with either Bitmovin or another third-party service provider or Company contributing to this project. Any and all updates are purely at the contributor's discretion.

Thank you for your contributions!

## Usage

This integration completely encapsulates the usage of Yospace. After creating the player it can be used like a normal [Bitmovin Player](https://bitmovin.com/docs/player) instance.

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
5. Add the relevant Bitmovin Player modules to the `Player` object using the static `Player.addModule(...)` API. Please note that `bitmovinplayer-advertising-core` and `bitmovinplayer-advertising-bitmovin` are required by this integration and must be provided.
6. Create a new player instance, and pass the `BitmovinPlayerStaticAPI` to it: `new BitmovinYospacePlayer(Player, container, config)`
7. Load a `YospaceSourceConfig` with your Yospace HLS/DASH URL. It's a `PlayerConfig` with Yospace-specific extension. Most important extension is the `assetType`, which needs to be set. In addition, HLS is picked before DASH, so if the user wants to play a dash stream the hls config has to be omitted.

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
  // omit 'hls' field if dash stream is intended
  hls: 'your yospace url',
  dash: 'your yospace url',

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
    app_id : "Ff4zhu5kqV.TizenBitmovinPlayerAppMode" // This should be your Tizen App Id which needs to be allow-listed in Player License and optionally, Analytics License
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
- Import the `tizen` folder (as General -> Existing Project) into Tizen Studio and run as a Tizen Web Application, or open the folder in Visual Studio Code with the tizen-tv extension.

### WebOS

#### WebOS Config

- Include the following Tweaks to the PlayerConfig:

```
tweaks: {
    ...
    file_protocol : true, // Required if app is being loaded from file system
    app_id : "com.bitmovin.yospace.demo" // This should be your WebOS App Id which needs to be allow-listed in Player License and optionally, Analytics License
}
```

- Make sure the app_id is allow-listed in your Player's License
- In the `YospaceConfig` set the param `YospaceConfig.disableServiceWorker` to `true`
- In the `YospaceConfig` set the param `YospaceConfig.useWebos` to `true`

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
- Open the `WebOS` folder in Visual Studio Code with the WebOS TV extension, or use the WebOS CLI directly.

## Limitations

- No support for ad tracking during live streams in Safari if EMSG tags are used. (EMSG tags are not supported by Safari)

## Development, Contribution, Releases

### Set up dev environment

1. Use node.js version specified in `.nvmrc`
2. Set up your access to the private npm registry of Yospace
3. Run `npm ci`
4. Use `npm run start` to run a webpack dev server

### Branching & Development

- This repo uses semantic versioning. Features and bug fixes should be implemented in separate feature branches, branch off the `main` branch.
- PRs should be made against `main` branch
- PRs should always contain an update of the [CHANGELOG.md](CHANGELOG.md) file

### Validation & Release
- Especially when updating the Yospace SDK, this project should be validated following https://developer.yospace.com/sdk-documentation/javascript/userguide/yosdk/latest/en/validate-your-app.html. This can be done using the sample page with the following steps:
  1. Run `npm start`
  2. Open `localhost:8080?validation=true` in a browser
  3. Select a source from the list to start playback and the validation logs. Alternatively, you can add the URL parameter `autoLoadSource=1` (to load the first source in the list).
  4. Save console logs and upload them to the [Yospace validation tool](https://sdkvalidation.yospace.com/)
- Releasing a new version is fully automated. It can be triggered using the [Release a new version](https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/actions/workflows/release.yml) Github Action on the `main` branch. The workflow will:
  - bump the version automatically based on the current version in `package.json` and changes in the `[Unreleased]` section of the `CHANGELOG.md`
  - build the project
  - tag the new release in git
  - create a new release on GitHub
  - publish the update to [npm](https://www.npmjs.com/package/@bitmovin/player-integration-yospace)

### Principles

- The Bitmovin Player shall not be packaged into the JS file created by the build of this integration. To achieve this, types can be imported and used, but no code must be imported/used (including string enums!)
