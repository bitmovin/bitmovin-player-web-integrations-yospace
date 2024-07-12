var sources = {
  vod: {
    yospaceValidationPreroll: {
      title: 'Yospace Validation (w/ pre-roll)',
      hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/access/156611618/c2FtcGxlL21hc3Rlci5tM3U4?yo.av=3',
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.VOD,
    },
    yospaceValidationNoPreroll: {
      title: 'Yospace Validation (w/o pre-roll)',
      hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/access/207411697/c2FtcGxlL21hc3Rlci5tM3U4?yo.av=3',
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.VOD,
    },
    noYospaceArtOfMotion: {
      title: 'Art of Motion (no ads)',
      dash: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd',
      hls: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
      poster: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/poster.jpg',
      thumbnailTrack: {
        url: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/thumbnails/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.vtt',
      },
    },
  },
  linear: {
    foxSports1: {
      title: 'Fox Sports 1 (valid 30 days, US IP required)',
      hls: 'https://foxvideo-sports.global.ssl.fastly.net/live/foxsports1-ue1/index.m3u8?ad_env=1&_fw_ae=nomvpd&_fw_did=85fe6c6c-1f37-68e4-c0f1-872d10abbda6&_fw_did_android_id=&_fw_did_google_advertising_id=&_fw_did_idfa=&_fw_is_lat=0&_fw_nielsen_app_id=P5CFA3B51-3361-481F-B75D-D119A71FF616&_fw_seg=&_fw_us_privacy=1YNN&_fw_vcid2=516429%3A85fe6c6c-1f37-68e4-c0f1-872d10abbda6&ad=fw_prod&ad.csid=fsapp%2Fwebdesktop%2Flive%2Ffs1&ad.flags=+slcb+sltp+qtcb+emcr+fbad+dtrd+vicb&ad.metr=7&ad.prof=516429%3Ayospace_foxsports_webdesktop_live&ad_env=1&ad_mode=JIT&bu=sports&bu=sports&caid=EP044429620282&cdn=fa&duration=2629743&is_lat=0&kuid=&mcl_region=ue1&mcl_region=ue1&thumbsray=0&traceid=watch-watch-cj%28Mo%25c9mz2B&yo.av=4&yo.eb.bp=profile-jit&yo.lpa=dur&yo.pdt=sync&yo.po=-3&yo.pst=true&yo.t.jt=1500&yo.t.pr=1500&yo.ug=11801&yo.vm=W3siREVTSVJFRF9EVVJBVElPTiI6ICIke0RFU0lSRURfRFVSQVRJT05fU0VDU30iLCAiUFJPR1JBTV9DQUlEIjogIiR7TUVUQURBVEEuQ0FJRH0ifV0K&hdnts=exp%3D1721980028~acl%3D%2F*~hmac%3Daad9f5ad88816a1eee5ab68a4e018e66cc54ac246383c02a17fb545d8bbabb06',
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.LINEAR,
    },
    yospaceValidation: {
      title: 'Yospace Validation',
      dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk01,t2-dash.mpd?yo.av=3', // v0 emsg
      // dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk01,dash.mpd?yo.av=3', // v1 emsg
      // hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yospace02,hlssample42.m3u8?yo.br=true&yo.av=3',
      // Yospace configuration
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.LINEAR,
    },
  },
};
