# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## develop

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

[1.2.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/bitmovin/bitmovin-player-web-integrations-yospace/compare/1406694e8e7c63bfa9d24b84fd6253b135cc0e74...1.0.0