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
    yospaceValidation: {
      title: 'Yospace Validation',
      // dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk02,dash-mp4.mpd?yo.br=true&yo.av=4',
      hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk02,hls-ts.m3u8?yo.br=true&yo.av=4',
      // Yospace configuration
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.LINEAR,
    },
    dvrLive: {
      title: 'DVR Live',
      // dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk02,dash-mp4-pre.mpd?yo.br=false&yo.av=4&yo.lp=true',
      hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk02,hls-ts-pre.m3u8?yo.br=false&yo.av=4&yo.lp=true',
      // Yospace configuration
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.DVRLIVE,
    },
  },
};
