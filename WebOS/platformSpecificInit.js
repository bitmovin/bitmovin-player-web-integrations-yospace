var platformReadyForPlayerPromise = (function () {
  // If the app is started shortly after webOS is rebooted the DRM system and CMD
  // might not be fully ready to use for DRM playback. Therefore we should await
  // drmAgents onsuccess callback before we try to load DRM source.

  var keySystem = webOSDev && webOSDev.DRM.Type.WIDEVINE;
  var webosDrmAgent = webOSDev && keySystem && webOSDev.drmAgent(keySystem);

  if (!webosDrmAgent) {
    return Promise.reject('No drmAgent');
  }

  function loadDrm(drmAgent) {
    return new Promise(function (resolve, reject) {
      try {
        drmAgent.load({
          onSuccess: function (res) {
            resolve(res);
          },
          onFailure: function (e) {
            reject(e);
          },
        });
      } catch (e) {
        reject('Error while loading DRM manager', e);
      }
    });
  }

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

function updateWithPlatformSpecificConfig(config) {
  config.tweaks = config.tweaks || {};
  config.tweaks.file_protocol = true;
  config.tweaks.app_id = 'com.bitmovin.bitmovinyospaceplayer.demo';
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

var platformType = 'webos';
