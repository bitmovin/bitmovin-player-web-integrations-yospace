# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

### Changed

- `AdBreak`s can now be null, which aligns with reality. It is possible for the Yospace SDK to not have had time to parse the metadata by the time the ad break triggers, which can cause the ad break to be null by the time the break starts. Note: the yospace documentation is wrongly indicating that this shouldn't be the case
- Use strict type checks in build tools to improve type safety
- Bump Bitmovin-Analytics to `2.43.3` and use Player-specific build

### Fixed

- Errors relating to method calls on `undefined` when starting non-VOD content
- Yospace integration crashing internally when the `AdBreak` for an event raised by the Yospace SDK is `null`

## [2.9.2] - 2025-03-24

### Fixed

- Calling AdvertisingApi.getActiveAdBreak() when player is briefly in-between adFinished and adStarted events resulted in undefined being returned

## [2.9.1] - 2025-02-10

### Fixed

- Calling `destroy` during an ongoing `load` process resulted in non-capturable error being thrown

## [2.9.0] - 2024-12-05

### Changed

- Improve startup behavior for `LINEAR` and `DVRLIVE` streams according to https://developer.yospace.com/sdk-documentation/javascript/userguide/yosdk/latest/en/optimising-user-experience-at-video-start.html

### Fixed

- Missing `issuer` in `Muted`, `Unmuted` and `Paused` events

## [2.8.0] - 2024-10-30

### Added

- Support for the `DVRLIVE` PlaybackMode to not rely on Metadata parsing for live streams anymore

### Changed

- Yospace SDK to v3.8.3

### Fixed

- Wrong playback position after skipping over ad breaks using ad immunity

## [2.7.1] - 2024-10-03

### Fixed

- Yospace error on source load and session initialization not returned in `load` promise rejection as reason
- Seeking over ad breaks during ad immunity led to wrong seek end position
- Default policy not aware of ad immunity, sometimes leading to wrong decisions for `canSeekTo`

## [2.7.0] - 2024-09-27

### Added

- `AdImmunityConfig.disablePassedAdBreaks` option to only temporarily disable ad breaks during the ad immunity instead of disabling them for the whole session

## [2.6.0] - 2024-09-25

### Changed

- Yospace SDK to v3.6.9

### Fixed

- Parsing non-Yospace ID3 tags and passing those to the Yospace SDK
- Small memory leak where player listeners were not detached

## [2.5.0] - 2024-07-10

### Added

- `mode` argument to `getCurrentTime` to enable fetching absolute time including ad durations
- `mode` argument to `getDuration` to enable fetching absolute duration including ad durations
- ad immunity feature:

  The user will become immune to ad breaks for a duration upon
  fully watching an ad break.

  Ad breaks played over or seeked past during immunity will be marked
  as deactivated, making the user permanently immune to them.

  Post-roll ads and ads with unknown positioning are excluded from ad immunity.

  By default, pre-rolls are also excluded, since the user needs to finish
  an ad break to enter an ad immunity period.

  `setAdImmunityConfig(options: AdImmunityConfig): void;`

  Returns the current ad immunity configuration.

  `getAdImmunityConfig(): AdImmunityConfig;`

  Returns a boolean value indicating if the user is currently immune to ad breaks
  `isAdImmunityActive(): boolean;`

  Immediately starts an ad immunity period, if ad immunity config exists. This method does nothing if ad immunity is already active.
  `startAdImmunity(): void;`

  Immediately ends an ongoing ad immunity period, before it would naturally expire
  `endAdImmunity(): void;`

- ad immunity events to `YospacePlayerEvent` enum

## [2.4.0] - 2024-06-21

### Added

- `mode` argument to `getCurrentTime` to enable fetching absolute time including ad durations
- `mode` argument to `getDuration` to enable fetching absolute duration including ad durations

### Fixed

- Event loop on pre-roll ad end
- Bitmovin Player getting bundled into the YospaceBitmovinPlayer

## [2.3.1] - 2024-02-14

### Removed

- Node "16.15.1" engines requirement from npm package.

## [2.3.0] - 2023-05-02

### Changed

- Yospace SDK to v3.6.0
- Bitmovin Player to version [8.114.0](https://developer.bitmovin.com/playback/docs/release-notes-web#81140)

## [2.2.0] - 2023-02-09

### Added

- Support for DASH LIVE and VOD streams
- New error code SUPPORTED_SOURCE_MISSING (1012)
- Support for pre-roll ads

### Removed

- Yospace Error code `HLS_SOURCE_MISSING` (1010) has now been deprecated in favor of `SUPPORTED_SOURCE_MISSING` (1012)

## [2.1.0] - 2022-10-20

### Added

- Support for `EMSG` v1 metadata with scheme ID `https://aomedia.org/emsg/ID3`

## [2.0.0] - 2022-07-06

### Added

- `clickThroughUrlOpened` method to Companion Ads, which should be fired when the ad is interacted with
- `canBeShown` method to Companion Ads, which indicates if the companion ad is currently active and can be shown
- `shownToUser` method to Companion Ads, which should be fired when the ad is shown to the user
- `hiddenFromUser` method to Companion Ads, which should be fired when the ad is hidden from the user
- `UNKNOWN_FORMAT` error (code `1011`)
- `YospaceConfiguration.debugYospaceSdk` to enable debug logs of the Yospace SDK without enabling logs for
  the `BitmovinYospacePlayer` (helpful for Yospace validation)
- Support for tracking muted/unmuted changes

### Changed

- Yospace SDK to v3
- Using NPM packages
- `BitmovinYospacePlayer` constructor to receive the Bitmovin Player Static API
- `getYospaceManager` to `getYospaceSession`
- Build chain to use webpack, eslint and prettier
- Yospace SDK to be imported via npm
- Events of the `BitmovinYospacePlayer` are now triggered asynchronously

### Removed

- VPAID support including all related configuration options
- LINEAR_START_OVER support
- `NO_LIVEPAUSE` error (code `1008`)
- `NON_YOSPACE_URL` error (code `1009`)
- `companionClickTrackingURLTemplates` array from Companion Ads
- `creativeTrackingEvents` array from Companion Ads
- `disableStrictBreaks` from `YospaceConfiguration`
- `setup` method
- unregistering all ServiceWorkers in the setup flow

## [1.2.25] - 2021-09-03

### Added

- YospaceConfig parameter `vodVpaidDurationAdjustment` for corrective VPAID timings on VOD

### Fixed

- Sequential VPAIDs sometimes getting skipped on VOD assets

## [1.2.24] - 2021-08-19

### Added

- YospaceConfig parameter `vpaidStaticVastXmlOverride` for overriding VPAID xml files for testing

### Changed

- Bitmovin player to version [8.66.0](https://developer.bitmovin.com/playback/docs/release-notes-web#8660)
- Flag `removeUnsupportedExtensions `to `false`

### Fixed

- Bitmovin Ad Module error when encountering AdVerifications in nested Extension
- Playback occasionally freezing on Tizen when switching periods/discontinuities

## [1.2.23] - 2021-06-23

### Added

- WebOS Module and Demo Folder
- YospaceConfig param for `useTizen` and `useWebos` to guard adding those modules
- Bumped Bitmovin Player version to `8.58.0` for required Tizen/WebOS bug fixes
- Missing DRM API added in 8.58.0 API

### Changed

- Tizen Demo Updates for latest SmartTv Convig params in YospaceConfig

## [1.2.22] - 2021-05-10

### Changed

- Add Tizen and WebOS Bitmovin Modules

## [1.2.21] - 2021-03-03

### Changed

- Use standalone Bitmovin Analytics Adapter for flexibility. And move initialization to `load()` to dynamically attach
  to the correct player based on source.
  - Note: This change required updating to TypeScript version 3.

## [1.2.20] - 2021-02-12

### Fixed

- Remove the [arrayAccessForm](https://github.com/x2js/x2js/blob/development/x2js.d.ts#L116), config option from `X2JS`
  initialization for parsing VAST Extensions. This was causing unpredictable arrays for
  the `Extension.CreativeParameters` property. Without the option, it consistently returns an object when there is only
  one `CreativeParameter` property.

## [1.2.20-2] - 2021-07-28

### Added

- Workaround for failed VPAID rendering for Extensions

### Fixed

- Additional Quartile beacons fired at the end of playback for some Ads

## [1.2.20-1] - 2021-07-19

### Fixed

- Duplicate `defaultImpression` events fired for VPAID pre-rolls
- VPAID pre-roll stuttering

## [1.2.19] - 2021-01-20

### Added

- `id`, `creativeId`, `adTitle`, `advertiser` and `lineage` properties to `YospaceLinearAd`.

### Changed

- Use `session.getCurrentBreak()` for the `ads.getCurrentAdBreak()`
- Refactor `CreateAdBreakEvent` to take a `YospaceAdBreakEvent`.

### Fixed

- Added a temporary fix for a bug on Safari mobile that results in duplicate ad events from Yospace, as a result of
  incorrect Position updates reported to the YS SDK.

## [1.2.18] - 2020-12-09

### Changed

- Update `bitmovin-player` to version `8.50.0`
- Remove suppression of `AdClicked` event so it can be consumed by integrators for VPAID ads.

## [1.2.17] - 2020-11-12

### Changed

- Update `bitmovin-player` to version `8.48.2`

## [1.2.16] - 2020-10-24

### Changed

- Update `bitmovin-player` to version `8.47.1-b.3`

### Fixed

- Type error in `onVpaidAdBreakStarted` event handler.
- Correct expected format for `staticResource` in companion ad. Per section 3.15.1 of the VAST Spec.

## [1.2.15] - 2020-10-16

### Added

- Emit `metadataParsed` and `metadata` events for generated EMSG/ID3 tags in the DateRangeEmitter.
- Support for companion ads that have multiple `variations`.

## [1.2.14] - 2020-10-01

### Changed

- Update `bitmovin-player` to version `8.45.1`

## [1.2.13] - 2020-07-10

### Changed

- Update `bitmovin-player` to version `8.39.0`

## [1.2.12] - 2020-06-18

### Changed

- Update `bitmovin-player` to version `8.37.1`.

### Fixed

- Suppress Yospace Analytics before sending the Pause event at the start of a VPAID, per Yospace recommendation.
- Remove `-2` adjustment to `replaceContentDuration` for Truex VPAID ads, as seeking logic is handled in TUB.

## [1.2.11] - 2020-05-27

### Changed

- Upgrade to `bitmovin-player` version `8.35.1`. Same functionality as the beta mentioned below.

## [1.2.10] - 2020-05-22

### Changed

- Upgrade `bitmovin-player` to version `8.35.1-b.1` which resolves issues with parsing Closed Captions.

## [1.2.9] - 2020-05-14

### Added

- Exposed new `YSAdBreak.position` property

### Changed

- Set `YSParseUtils.NAMESPACES = true` to resolve an XML parsing issue on Smart TVs
- Upgrade `bitmovin-player` to version `8.35.0`

### Fixed

- Remove code to destroy both players as it was causing an exception and not needed.

## [1.2.8] - 2020-05-07

### Added

- Expose `YospaceAdBreak` and `YospaceAdBreakEvent` interfaces for use by integrators.

## [1.2.7] - 2020-05-01

### Changed

- Bump `bitmovin-player` to version `8.34.0`

## [1.2.6] - 2020-04-22

### Fixed

- When the `disableServiceWorker` flag is set to true, don't make calls to `navigator.serviceWorker.getRegistrations()`.
  This was causing issues on Tizen devices.

## [1.2.5] - 2020-04-15

### Changed

- Bump `bitmovin-player` to version `8.33.0`

## [1.2.4] - 2020-04-06

### Changed

- Revert `isLive()` method to return response from `player.isLive()`. Only use `isLiveStream` when cleaning up VPAID.

## [1.2.3] - 2020-03-27

### Changed

- Downgrade Bitmovin Web SDK to 8.29.1 because of issues found with transitioning out of VPAID Ads.

## [1.2.2] - 2020-03-19

### Changed

- Fire `TruexAdFree` in the `adBreakFinished` listener instead of `adFinished`, as the stream isn't fully reloaded for
  seeking after `adFinished`
- Update Bitmovin Web SDK to 08.31.0
- `player.isLive()` returns false when in a VPAID, so store `isLiveStream` in a variable upon playing the stream.

## [1.2.0] - 2020-03-03

### Added

- Log a table of upcoming DateRange events which will be emitted
- `forceSeek` method that allows you to seek to a location without having that location changed due to the player policy

### Changed

- Always fire the `TrueXAdFree` event
- Reduce the replaceContentDuration by 2 seconds in order to allow the player to properly skip the VPAID / TrueX ad if
  needed
- Updated Bitmovin Web SDK to 8.30.0
- Fire a new `TruexAdBreakFinished` event

## [1.1.0] - 2020-02-18

### Changed

- Updated Bitmovin Web SDK to 8.29.1

## 1.0.0 - 2020-02-18

### Added

- Initial yospace integration

[unreleased]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.9.2...HEAD
[2.9.2]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.9.1...v2.9.2
[2.9.1]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.7.1...v2.8.0
[2.7.1]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.25...v2.0.0
[1.2.25]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.24...v1.2.25
[1.2.24]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.23...v1.2.24
[1.2.23]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.22...v1.2.23
[1.2.22]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.21...v1.2.22
[1.2.21]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.20...v1.2.21
[1.2.20]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.20-2...v1.2.20
[1.2.20-2]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.20-1...v1.2.20-2
[1.2.20-1]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.19...v1.2.20-1
[1.2.19]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.18...v1.2.19
[1.2.18]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.17...v1.2.18
[1.2.17]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.16...v1.2.17
[1.2.16]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.15...v1.2.16
[1.2.15]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.14...v1.2.15
[1.2.14]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.13...v1.2.14
[1.2.13]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.12...v1.2.13
[1.2.12]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.11...v1.2.12
[1.2.11]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.10...v1.2.11
[1.2.10]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.9...v1.2.10
[1.2.9]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.8...v1.2.9
[1.2.8]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.7...v1.2.8
[1.2.7]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.2.0...v1.2.2
[1.2.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/v1.0.0...v1.1.0
