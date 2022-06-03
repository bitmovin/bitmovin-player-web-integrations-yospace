# Bitmovin Player Yospace Integration

This integration completely encapsulates the usage of Yospace. After creating the player it can be used like a normal [Bitmovin Player](https://bitmovin.com/docs/player) instance.

## Usage

### Basic Setup
1. Build the script by running `gulp build-prod`
2. Include `bitmovinplayer-yospace.min.js` **after** `yo-ad-management.min.js` in your HTML document
3. Create an instance of `BitmovinYospacePlayer`
```js
var playerConfig = {
  key: 'YOUR-PLAYER-KEY'
};

var playerContainer = document.getElementById('player');
var yospacePlayer = bitmovin.player.ads.yospace.BitmovinYospacePlayer(playerContainer, playerConfig);

// Create the UI afterwards (see https://github.com/bitmovin/bitmovin-player-ui for details)
bitmovin.playerui.UIFactory.buildDefaultUI(yospacePlayer);

// Load a new yospace source
var source = {
  hls: 'your yospace url',

  // The type of the asset
  assetType: bitmovin.player.ads.yospace.YospaceAssetType.LINEAR
  // one of:
  // - bitmovin.player.ads.yospace.YospaceAssetType.LINEAR
  // - bitmovin.player.ads.yospace.YospaceAssetType.VOD
};

yospacePlayer.load(source);
```

### Advanced Setup

#### Policy

As there can be different rules for different use-cases we provide a `BitmovinYospacePlayerPolicy` interface which can be implemented.
In this policy you can define which actions should be allowed during playback.

You can set the policy right after initialization by calling:

```js
yospacePlayer.setPolicy(...); // pass in your policy object which implements BitmovinYospacePlayerPolicy
```

We also provide a default policy.  
See [BitmovinYospacePlayerPolicy](./src/ts/BitmovinYospacePlayerPolicy.ts) for more details.

#### Config
You can pass a third optional parameter to the player constructor:
```js
var yospaceConfig = {
  debug: true
};
...
var yospacePlayer = new bitmovin.player.ads.yospace.BitmovinYospacePlayer(playerContainer, conf, yospaceConfig);

```

### Tizen
#### Tizen Config
- Include the following Tweaks to the PlayerConfig:
```
tweaks: {
    ...
    file_protocol : true, // Required if app is being loaded from file system
    app_id : "Ff4zhu5kqV.TizenBitmovinPlayerAppMode" // this Tizen App Id should also be allow-listed in Player License and optionally, Analaytics License
}
```
- Make sure the app_id is allow-listed in your Player's License
- In the `YospaceConfig` set the param `YospaceConfig.disableServiceWorker` to `true`
- In the `YospaceConfig` set the param `YospaceConfig.useTizen` to `true`
```
// Yospace configuration
var yospaceConfig = {
    ...
    disableServiceWorker: true, //Disable Service Worker for Tizen Web App use
    useTizen: true,
};
```

#### Tizen Demo
- Run `npm run build-tv`
- Import the Tizen folder(as General -> Existing Project) into your Tizen Studio and run as a Tizen Web Application

## Limitations

- No support for ad tracking during live streams in Safari if EMSG tags are used. (EMSG tags are not supported by Safari)
