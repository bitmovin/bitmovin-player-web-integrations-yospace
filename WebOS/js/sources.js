var sources = {
  vod: {
    yospaceSourceTwoVod: {
      title: 'Optus 2',
      poster: '',
      drm: {
        playready: {
          LA_URL: 'https://93e30b04-drm-playready-licensing.axprod.net/AcquireLicense',
          headers: {
            'X-AxDRM-Message':
              'DRM KEY',
          },
        },
        widevine: {
          LA_URL: 'https://93e30b04-drm-widevine-licensing.axprod.net/AcquireLicense',
          headers: {
            'X-AxDRM-Message':
              'DRM KEY',
          },
          certificateURL: 'https://drm-widevine-licensing.axprod.net/ServiceCertificate',
          withCredentials: false,
        },
        immediateLicenseRequest: true,
      },
      labeling: {
        hls: {},
        dash: {},
      },
      assetType: 1,
      hls: 'https://csm-e-ceoptstgaase2vpr416-0e14a2c49fae4be66.bln1.yospace.com/csm/access/467176222/aHR0cHM6Ly92b2QtYS5mYXN0bHkuc3RhZ2luZ29wdHVzdmlkZW8udHYvdjEvYXBzZTItbXAvY21hZi83MWMzYTBiODI3NDM0YzU5OGE3ZmZiODE5M2Y2ZTRlNi9jNzBmNGZhOTlhYmY0YTI5YmYzOGM0NWFlYjM1NzhkNy81ZWJlNGRlZThiMzE0OWU5YWI4MWE5MDJmODVjZDQ4YS9tYW5pZmVzdC5tM3U4?yo.up=https%3A%2F%2Fvod-a.fastly.stagingoptusvideo.tv%2Fv1%2Fapse2-mp%2Fcmaf%2F71c3a0b827434c598a7ffb8193f6e4e6%2Fc70f4fa99abf4a29bf38c45aeb3578d7%2F5ebe4dee8b3149e9ab81a902f85cd48a%2F&yo.ap=https%3A%2F%2Fvod-a.fastly.stagingoptusvideo.tv%2Fysp-creative%2F&assetId=os27659&userType=premium&tvid=c3ce0c2e182e44d08d0c9c7c6e5be3bb&yo.ac=true&yo.av=3&deviceId=5592b4ef-311f-4501-b65b-f7688e6668e9&platform=web&userId=9af28dee-5165-4da9-8118-343b3e33902d&yo.lb=2000&yo.ad=true',
      options: {
        startOffset: 0,
      },
    },
  },
  linear: {
    yospaceSourceOne: {
      title: 'Optus 1',
      poster: '',
      drm: {
        playready: {
          LA_URL: 'https://93e30b04-drm-playready-licensing.axprod.net/AcquireLicense',
          headers: {
            'X-AxDRM-Message':
              'DRM KEY',
          },
        },
        widevine: {
          LA_URL: 'https://93e30b04-drm-widevine-licensing.axprod.net/AcquireLicense',
          headers: {
            'X-AxDRM-Message':
              'DRM KEY',
          },
          certificateURL: 'https://drm-widevine-licensing.axprod.net/ServiceCertificate',
          withCredentials: false,
        },
      },
      labeling: {
        hls: {},
        dash: {},
      },
      assetType: 0, // LIVE
      hls: 'https://csm-e-ceoptstgaase2live101-0605dc1bbd5444d90.bln1.yospace.com/csm/extlive/optusauuat01,OS2-CMAF-S.m3u8?yo.up=https%3A%2F%2Flinear-a.fastly.stagingoptusvideo.tv%2Fv7%2FOptusSport2%2Fxbtss%2Fdrm%2Fhevc%2Fcmaf%2Fscte%2F&yo.ap=https%3A%2F%2Flinear-a.fastly.stagingoptusvideo.tv%2Fysp-creative%2F&channelId=os2&assetId=os23037&userType=premium&tvid=c3ce0c2e182e44d08d0c9c7c6e5be3bb&yo.ac=true&yo.av=3&deviceId=5592b4ef-311f-4501-b65b-f7688e6668e9&platform=web&ppid=5fcf1f48-8828-49bc-93be-a1f8c48d95a2&userId=7ca8c58f-7fb4-4990-8cc4-1d926ddf75a0&yo.lb=2000&yo.ad=true',
    },
  },
};
