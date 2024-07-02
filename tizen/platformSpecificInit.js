var platformReadyForPlayerPromise = (function () {
  return Promise.resolve();
})();

function updateWithPlatformSpecificConfig(config) {
  config.tweaks = config.tweaks || {};
  config.tweaks.file_protocol = true;
  config.tweaks.app_id = 'Ff4zhu5kqV.TizenBitmovinYospacePlayer';
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

var platformType = 'tizen';
