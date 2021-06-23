var sources = {
    vodSource: {
        title: 'VOD Stream',
        hls: 'https://vod-manifests-aka-qa.warnermediacdn.com/csm/tcm/clear/3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c/master_cl.m3u8?afid=222591187&caid=2100555&conf_csid=tbs.com_videopage_test&context=182883174&nw=42448&prof=48804%3Amp4_plus_vast_truex&vdur=1800&yo.vp=true',
        assetType: bitmovin.player.ads.yospace.YospaceAssetType.VOD,
    },
    vodVpaidSource: {
        title: 'VOD Stream',
        hls: 'https://vod-manifests-aka-qa.warnermediacdn.com/csm/tcm/clear/3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c/master_cl.m3u8?afid=222591187&caid=2100555&conf_csid=tbs.com_videopage&context=182883174&nw=42448&prof=48804%3Atbs_web_vod&vdur=1800&yo.vp=true',
        // Yospace configuration
        assetType: bitmovin.player.ads.yospace.YospaceAssetType.VOD,
    },
    artOfMotionSource: {
        dash: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd',
        hls: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
        progressive: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/MI201109210084_mpeg-4_hd_high_1080p25_10mbits.mp4',
        poster: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/poster.jpg',
    }
}
