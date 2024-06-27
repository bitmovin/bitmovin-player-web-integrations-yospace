var platformReadyForPlayerPromise = (function () {
  return Promise.resolve();
})();

function updateWithPlatformSpecificConfig(conf) {
  config.tweaks = config.tweaks || {};
  config.tweaks.file_protocol = true;
  config.tweaks.app_id = 'Ff4zhu5kqV.TizenBitmovinYospacePlayer';
  return conf;
}

function updateWithPlatformSpecificSourceConfig(source) {
  return source;
}

var platformType = 'tizen';
