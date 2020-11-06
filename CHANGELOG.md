# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

# develop
## Changed
- Update `bitmovin-player` to version `8.48.0-rc.2`

# [1.2.16]
## Changed
- Update `bitmovin-player` to version `8.47.1-b.3`

## Fixed
- Type error in `onVpaidAdBreakStarted` event handler. 
- Correct expected format for `staticResource` in companion ad. Per section 3.15.1 of the VAST Spec.

## [1.2.15]
## Added
- Emit `metadataParsed` and `metadata` events for generated EMSG/ID3 tags in the DateRangeEmitter.
- Support for companion ads that have multiple `variations`.

## [1.2.14]
## Changed
- Update `bitmovin-player` to version `8.45.1`

## [1.2.13]
## Changed
- Update `bitmovin-player` to version `8.39.0`

## [1.2.12]
## Changed
- Update `bitmovin-player` to version `8.37.1`.

## Fixed
- Suppress Yospace Analytics before sending the Pause event at the start of a VPAID, per Yospace recommendation.
- Remove `-2` adjustment to `replaceContentDuration` for Truex VPAID ads, as seeking logic is handled in TUB. 

## [1.2.11]
## Changed
- Upgrade to `bitmovin-player` version `8.35.1`. Same functionality as the beta mentioned below. 

## [1.2.10]
## Changed
- Upgrade `bitmovin-player` to version `8.35.1-b.1` which resolves issues with parsing Closed Captions.

## [1.2.9]
## Added
- Exposed new `YSAdBreak.position` property

## Changed
- Set `YSParseUtils.NAMESPACES = true` to resolve an XML parsing issue on Smart TVs
- Upgrade `bitmovin-player` to version `8.35.0`

## Fixed
- Remove code to destroy both players as it was causing an exception and not needed. 

## [1.2.8]
## Added
- Expose `YospaceAdBreak` and `YospaceAdBreakEvent` interfaces for use by integrators. 

## [1.2.7]
## Changed
- Bump `bitmovin-player` to version `8.34.0`

## [1.2.6]
## Fixed
- When the `disableServiceWorker` flag is set to true, don't make calls to `navigator.serviceWorker.getRegistrations()`. This was causing issues on Tizen devices. 

## [1.2.5]
## Changed
- Bump `bitmovin-player` to version `8.33.0`

## [1.2.4]
## Changed
- Revert `isLive()` method to return response from `player.isLive()`. Only use `isLiveStream` when cleaning up VPAID. 

## [1.2.3]
## Changed
- Downgrade Bitmovin Web SDK to 8.29.1 because of issues found with transitioning out of VPAID Ads.

## [1.2.2]

## Changed
- Fire `TruexAdFree` in the `adBreakFinished` listener instead of `adFinished`, as the stream isn't fully reloaded for seeking after `adFinished`
- Update Bitmovin Web SDK to 08.31.0
- `player.isLive()` returns false when in a VPAID, so store `isLiveStream` in a variable upon playing the stream.

## [1.2.0]

## Added
- Log a table of upcoming DateRange events which will be emitted
- `forceSeek` method that allows you to seek to a location without having that location changed due to the player policy
## Changed
- Always fire the `TrueXAdFree` event
- Reduce the replaceContentDuration by 2 seconds in order to allow the player to properly skip the VPAID / TrueX ad if needed
- Updated Bitmovin Web SDK to 8.30.0
- Fire a new `TruexAdBreakFinished` event

## [1.1.0]

## Changed
- Updated Bitmovin Web SDK to 8.29.1

## [1.0.0]

### Added
- Initial yospace integration

[1.2.16]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.15...1.2.16
[1.2.15]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.14...1.2.15
[1.2.14]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.13...1.2.14
[1.2.13]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.12...1.2.13
[1.2.12]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.11...1.2.12
[1.2.11]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.10...1.2.11
[1.2.10]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.9...1.2.10
[1.2.9]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.8...1.2.9
[1.2.8]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.7...1.2.8
[1.2.7]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.6...1.2.7
[1.2.6]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.5...1.2.6
[1.2.5]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.4...1.2.5
[1.2.4]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.3...1.2.4
[1.2.3]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.2...1.2.3
[1.2.2]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.2.1...1.2.2
[1.2.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1406694e8e7c63bfa9d24b84fd6253b135cc0e74...1.0.0