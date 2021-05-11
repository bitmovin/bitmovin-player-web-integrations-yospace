var player;
var tubPlayer;
var loadTime;
var startupTimeCalculated = false;

window.onload = function() {
	//setupPlayer();
	loadTub();
	setupControllerEvents();
}

var tubConfiguration = {
	playerConfig: {
		key: '18ca6ad5-9768-4129-bdf6-17685e0d14d2',
		playback: {
			muted: false,
			autoplay: true,
		},
		logs: {
			level: 'warning',
		},
		analytics: {
			key: 'a57d4f88-c20f-4544-a88a-bcc41450a7c2',
		},
		tweaks: {
			enable_seek_for_live: true,
		},
		ui: false,
	},
	// refreshDrmToken: function() {
	//   return Promise.resolve('newToken');
	// },
	debug: false,
	disableServiceWorker: false
};

var tbseWvPreSource = {
	title: 'TBSE WV Pre-Prod',
	hls: 'https://live-manifests-aka-qa.warnermediacdn.com/csmp/cmaf/live/2023198/tbseast-cenc/master_wv_de.m3u8?afid=180483280&conf_csid=tnt.tv_desktop_live_east&nw=42448&prof=48804%3Atnt_web_live&yo.pst=true&yo.vp=true&yo.av=2&yo.asd=true&yo.ad=true&yo.dnt=false',
	// Yospace configuration
	assetType: tub.YospaceAssetType.LINEAR,
	analytics: {
		videoId: 'tbsewv',
		videoTitle: 'TBSE WV',
	},
	drm: {
		widevine: {
			LA_URL: 'https://widevine.license.istreamplanet.com/widevine/api/license/de4c1d30-ac22-4669-8824-19ba9a1dc128',
			headers: [
				{
					'x-isp-token': 'eyJ2ZXIiOjEsInR5cCI6IkpXVCIsImVuYyI6IkExMjhHQ00ifQ.6F66fu2wPVDLDmCmjDA0Kw.2AZnNjhhzUpHWaUmoGrYdjapmdEKi27rPPxvpbPy_kZHmgII2kCR7CKwrk-A_mq6qrrVlBdwXoRc9VGiAVteJdFVdhXqoqf5-8OyUzzdLenbpeyPT83sESQt20f_PJjULjeZjebAJVLYKmNoUJ9orChy02_HAkLH5s4DOi_MyowafZ1M-vjCT-p1AstvkNtIVYqbGcZHVcFcjBla06Z85v9_1oxb-H4Zc0uam7NcjkoUK2wxJvu9HG_FdE4jCz-WXb9yNA.CZ_C6vXncNlSYVlHBOYWxQ'
				}
			]
		}
	}
};

function loadTub(){
	var playerContainer = document.getElementById('player');
	tubPlayer = new tub.Tub(playerContainer, tubConfiguration);

	//Subscribe to events
	tubPlayer.on('yospaceerror', function(event) {
		console.error(event);
	})

	tubPlayer.unload();

	tubPlayer.load(tbseWvPreSource).then(function() {
		console.log('Successfully loaded Tub Source');
	}, function(reason) {
		console.error('Error loading Tub Source');
		console.error(reason);
	});

	//ISP.getToken('8c00a51042374c328794484dfe92971e00000000').then(function(token){
		//tbseWvPreSource.drm.widevine.headers['x-isp-token'] = token;
		//load(tbseWvPreSource);
	//})

}

function deselectCustomLoadButton() {
	$(customStreamButton).removeClass('active');
}

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2uint8(str) {
	var buf = new ArrayBuffer(str.length);
	var bufView = new Uint8Array(buf);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return bufView;
}



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
