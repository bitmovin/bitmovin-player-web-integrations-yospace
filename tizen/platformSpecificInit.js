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
  return source;
}

var platformType = 'tizen';
