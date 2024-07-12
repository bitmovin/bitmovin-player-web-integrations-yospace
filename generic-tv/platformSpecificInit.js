var platformReadyForPlayerPromise = (function () {
  return Promise.resolve();
})();

function updateWithPlatformSpecificConfig(config) {
  config.tweaks = config.adaptation || {};
  config.tweaks.maxStartupBitrate = '1.0mbps';
  return config;
}

function updateWithPlatformSpecificSourceConfig(source) {
  if (source.drm && source.drm.playready) {
    source.drm.playready.utf8message = true;
    source.drm.playready.plaintextChallenge = true;
    source.drm.playready.headers = source.drm.playready.headers || {};
    source.drm.playready.headers['Content-Type'] = 'text/xml';
  }
  return source;
}

var platformType = 'generic-tv';
