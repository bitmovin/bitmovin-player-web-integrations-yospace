var platformReadyForPlayerPromise = (function () {
  return Promise.resolve();
})();

function updateWithPlatformSpecificConfig(conf) {
  return conf;
}

function updateWithPlatformSpecificSourceConfig(source) {
  return source;
}

var platformType = 'tizen';
