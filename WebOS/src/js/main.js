/* eslint-env browser */
import {sources} from "../../../tizen/js/sources";

var yospacePlayer;

setupControllerEvents();

var truexAdFree = false // disable Truex

var conf = {
  key: 'edc2b14e-a636-49d7-a011-0c854fab98f3',
  playback: {
    muted: false,
    autoplay: true,
    preferredTech: [{
      player: 'html5',
      streaming: 'dash'
    }]
  },
  logs: {
    level: 'none',
  },
  ui: false,
  tweaks: {
    enable_seek_for_live: true,
    resume_live_content_at_previous_position_after_ad_break: true,
    file_protocol: true,
    app_id: 'com.bitmovin.demo.webapp',
    BACKWARD_BUFFER_PURGE_INTERVAL: 10
  }
};

// Yospace configuration
var yospaceConfig = {
  debug: false,
  disableVpaidRenderer: false,
  liveVpaidDurationAdjustment: 2,
  disableStrictBreaks: false,
  disableServiceWorker: true, //Disable Service Worker for Tizen Web App use
  useWebos: true,
};

var sampleYospacePlayerPolicy = {
  canMute: () => {
    return true;
  },
  canSeek: () => {
    return true;
  },
  canSeekTo: (seekTarget) => {
    return seekTarget;
  },
  canSkip: () => {
    return true;
  },
  canPause: () => {
    return true;
  },
  canChangePlaybackSpeed: () => {
    return true;
  },
};

var playerContainer = document.getElementById('player');
yospacePlayer = new bitmovin.player.ads.yospace.BitmovinYospacePlayer(playerContainer, conf, yospaceConfig);

var keySystem = webOSDev && webOSDev.DRM.Type.WIDEVINE;
var webosDrmAgent = getDrmAgent(keySystem);
// In the app is started shortly after webOS is rebooted the DRM system and CMD
// might not be fully ready to use for DRM playback. Therefore we should await
// drmAgents onsuccess callback before we try to load DRM source.
if (webosDrmAgent) {
  isDrmLoaded(webosDrmAgent)
      .then(function () {
        yospacePlayer.setup().then(function() {
          yospacePlayer.setPolicy(sampleYospacePlayerPolicy);
          yospacePlayer.load(sources.vodSource);
        })
      })
      .catch(function (e) {
        console.log('Error while loading drm Agent', e);
      });
}

function setupControllerEvents () {
  document.addEventListener('keydown', function (inEvent) {
    var keycode;

    if (window.event) {
      keycode = inEvent.keyCode;
    } else if (inEvent.which) {
      keycode = inEvent.which;
    }
    switch (keycode) {
      case 13:
        tooglePlayPause();
        break;
      case 415:
        // Play Button Pressed
        player.play();
        break;
      case 19:
        // Pause BUtton Pressed
        player.pause();
        break;
      case 412:
        // Jump Back 30 Seconds
        player.seek(player.getCurrentTime() - 30);
        break;
      case 417:
        // Jump Forward 30 Seconds
        player.seek(player.getCurrentTime() + 30);
        break;
      case 413:
        // Unload Player
        player.unload();
        break;
      default:
        console.log('Key Pressed: ' + keycode);
    }
  });
}

function tooglePlayPause () {
  if (player.isPaused()) {
    player.play();
  } else {
    player.pause();
  }
}

function getDrmAgent (keySystem) {
  return webOSDev && keySystem && webOSDev.drmAgent(keySystem);
}

function loadDrm (drmAgent) {
  return new Promise(function (resolve, reject) {
    try {
      drmAgent.load({
        onSuccess: function (res) {
          resolve(res);
        },
        onFailure: function (e) {
          reject(e);
        }
      })
    } catch (e) {
      reject('Error while loading DRM manager', e);
    }
  })
}

function isDrmLoaded (drmAgent) {
  return new Promise(function (resolve, reject) {
    if (!drmAgent) {
      return reject('No drmAgent');
    }

    drmAgent.isLoaded({
      onSuccess: function (response) {
        if (response.loadStatus === true) {
          resolve(response);
        } else {
          loadDrm(drmAgent)
            .then(function (result) {
              resolve(result);
            })
            .catch(function (err) {
              reject(err);
            })
        }
      },
      onFailure: function (err) {
        reject(err);
      }
    })
  })
}
