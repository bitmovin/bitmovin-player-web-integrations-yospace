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
      dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk01,t2-dash.mpd?yo.av=3', // v0 emsg
      // dash: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yosdk01,dash.mpd?yo.av=3', // v1 emsg
      // hls: 'https://csm-e-sdk-validation.bln1.yospace.com/csm/extlive/yospace02,hlssample42.m3u8?yo.br=true&yo.av=3',
      // Yospace configuration
      assetType: bitmovin.player.ads.yospace.YospaceAssetType.LINEAR,
    },
  },
};
