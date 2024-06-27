var platformReadyForPlayerPromise = (function () {
  var keySystem = webOSDev && webOSDev.DRM.Type.WIDEVINE;
  var webosDrmAgent = webOSDev && keySystem && webOSDev.drmAgent(keySystem);

  if (!webosDrmAgent) {
    return Promise.reject('No drmAgent');
  }

  // If the app is started shortly after webOS is rebooted the DRM system and CMD
  // might not be fully ready to use for DRM playback. Therefore we should await
  // drmAgents onsuccess callback before we try to load DRM source.

  return new Promise(function (resolve, reject) {
    webosDrmAgent.isLoaded({
      onSuccess: function (response) {
        if (response.loadStatus === true) {
          resolve(response);
        } else {
          loadDrm(webosDrmAgent)
            .then(function (result) {
              resolve(result);
            })
            .catch(function (err) {
              reject(err);
            });
        }
      },
      onFailure: function (err) {
        reject(err);
      },
    });
  });
})();

function updateWithPlatformSpecificConfig(conf) {
  config.tweaks = config.tweaks || {};
  config.tweaks.file_protocol = true;
  config.tweaks.app_id = 'com.bitmovin.bitmovinyospaceplayer.demo';
  return conf;
}

function updateWithPlatformSpecificSourceConfig(source) {
  return source;
}

var platformType = 'webos';
