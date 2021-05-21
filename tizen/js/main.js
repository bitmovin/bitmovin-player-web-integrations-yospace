import {sources} from "./sources";

var yospacePlayer;

setupControllerEvents();

var truexAdFree = false // disable Truex

var conf = {
    key: 'edc2b14e-a636-49d7-a011-0c854fab98f3',
    playback: {
        muted: false,
        autoplay: true,
    },
    logs: {
        level: 'none',
    },
    ui: false,
    tweaks: {
        enable_seek_for_live: true,
        resume_live_content_at_previous_position_after_ad_break: true,
        file_protocol : true, // Required if app is being loaded from file system
        app_id : "Ff4zhu5kqV.TizenBitmovinPlayerAppMode" // this Tizen App Id should also be whitelisted in Player License and optionallt, Analaytics License
    }
};

// Yospace configuration
var yospaceConfig = {
    debug: false,
    disableVpaidRenderer: false,
    liveVpaidDurationAdjustment: 2,
    disableStrictBreaks: false,
    disableServiceWorker: true, //Disable Service Worker for Tizen Web App use
    useTizen: true,
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

yospacePlayer.setup().then(function() {
    yospacePlayer.setPolicy(sampleYospacePlayerPolicy);
    yospacePlayer.load(sources.vodSource);
})

function setupControllerEvents() {
    tizen.tvinputdevice.registerKey('MediaPlayPause');
    tizen.tvinputdevice.registerKey('ColorF0Red');

    // add eventListener for keydown
    document.addEventListener('keydown', function(e) {
        switch (e.keyCode) {
            case tizen.tvinputdevice.getKey('MediaPlayPause').code:
                if (player.isPlaying()) {
                    player.pause();
                } else {
                    player.play();
                }
                break;
            case 37: // LEFT arrow
                break;
            case 38: // UP arrow
                break;
            case 39: // RIGHT arrow
                break;
            case 40: // DOWN arrow
                break;
            case 13: // OK button
                break;
            case 10009: // RETURN button
                tizen.application.getCurrentApplication().exit();
                break;
            default:
                console.log('Key code : ' + e.keyCode);
                break;
        }
    });
}
