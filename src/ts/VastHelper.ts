///<reference path="Yospace.d.ts"/>
///<reference path="VAST.d.ts"/>

import X2JS = require('x2js');
import { CompanionAdResource, CompanionAdType, YospaceCompanionAd } from './BitmovinYospacePlayerAPI';
import { Logger } from './Logger';
import stringify from 'fast-safe-stringify';

interface UriBuilderData {
  ad: VASTAd;
  removeTrackingBeacons: boolean;
  removeImpressions: boolean;
  removeUnsupportedExtensions: boolean;
}

export class VastHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS().dom2js(extension);
    });
  }

  static buildDataUriWithoutTracking(data: UriBuilderData): string {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    const { ad, removeImpressions, removeTrackingBeacons, removeUnsupportedExtensions } = data;
    const vastXML = ad.vastXML;

    // NOTE: Previously the only XML nodes from the VAST we were removing were
    // Tracking and TrackingEvents. It was noted originally that Yospace wasn't
    // surfacing Default Impressions so those had to be included so Bitmovin
    // could trigger them.
    //
    // After testing on a later release YS SDK 1.8.1, it appears Yospace is now
    // able to fire the Default Impressions, and because of that, duplicate impressions
    // were firing in some cases. It is now assumed that Yospace will handling
    // all beaconing, and Bitmovin will just render the physical VPAID.
    if (removeTrackingBeacons) {
      const beaconingEvents = ['TrackingEvents', 'Tracking'];
      this.removeXmlNodes(beaconingEvents, vastXML);
    }

    if (removeImpressions) {
      const impressions = ['Impression'];
      this.removeXmlNodes(impressions, vastXML);
    }

    // It appears in some cases the Bitmovin ad module fails to parse specific
    // Extensions. This is related to recursive Extensions:
    // https://jiraprod.turner.com/browse/MECBM-663
    if (removeUnsupportedExtensions) {
      const unsupportedExtensions = ['AVID'];
      this.removeXmlNodes(unsupportedExtensions, vastXML);
    }

    const vastVersion = vastXML.parentElement.getAttribute('version');
    // TODO: Change this back before merging
    // const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    const vastXMLString = '<VAST version="3.0"><Ad id="IMA3_YO_198154392" sequence="1"><InLine><AdSystem>VPAIDIMA3</AdSystem><AdTitle>IMA3</AdTitle><Impression>https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=defaultImpression&amp;et=i&amp;_cc=46483869,30277731,,79956.89795.89801.89802.90071.,1628276478,1&amp;tpos=0&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;metr=1023&amp;init=1&amp;vcid2=48804%3Aa133_6993393805244537958&amp;cr=</Impression><Impression>https://dh0c1bz67fuho.cloudfront.net/p/v.jpg?a=turnerprd01&amp;p=330357049&amp;cachebuster=3072387918</Impression><Creatives><Creative><Linear><Duration>00:00:01.000</Duration><TrackingEvents><Tracking event="complete">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=complete&amp;et=i&amp;_cc=&amp;tpos=0&amp;init=1&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;metr=1023</Tracking><Tracking event="firstQuartile">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=firstQuartile&amp;et=i&amp;_cc=&amp;tpos=0&amp;init=1&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;metr=1023</Tracking><Tracking event="midpoint">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=midPoint&amp;et=i&amp;_cc=&amp;tpos=0&amp;init=1&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;metr=1023</Tracking><Tracking event="thirdQuartile">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=thirdQuartile&amp;et=i&amp;_cc=&amp;tpos=0&amp;init=1&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;metr=1023</Tracking><Tracking event="mute">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_mute&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="unmute">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_un-mute&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="collapse">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_collapse&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="expand">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_expand&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="pause">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_pause&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="resume">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_resume&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="rewind">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_rewind&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="acceptInvitation">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_accept-invitation&amp;et=s&amp;_cc=&amp;tpos=0</Tracking><Tracking event="close">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=_close&amp;et=s&amp;_cc=&amp;tpos=0</Tracking></TrackingEvents><VideoClicks><ClickTracking id="FWc_46483869.0">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;auid=&amp;cn=defaultClick&amp;et=c&amp;_cc=&amp;tpos=0&amp;cr=</ClickTracking></VideoClicks><MediaFiles><MediaFile apiFramework="VPAID" delivery="progressive" height="480" type="application/javascript" width="640" >https://imasdk.googleapis.com/js/sdkloader/vpaid_adapter.js?adtagurl=https://pubads.g.doubleclick.net/gampad/live/ads%3Fiu%3D/8663477/ca-video-pub-7439281311086140-tag/1651364365%26description_url%3Dhttp%253A%252F%252Fwww.cnn.com%252Fpolitics%26tfcd%3D0%26npa%3D0%26sz%3D640x480%26min_ad_duration%3D6000%26max_ad_duration%3D30000%26gdfp_req%3D1%26output%3Dvast%26unviewed_position_start%3D1%26env%3Dvp%26vpos%3Dpreroll%26vpmute%3D0%26vpa%3D0%26type%3Djs%26vad_type%3Dlinear%26channel%3Dvastadp</MediaFile></MediaFiles></Linear></Creative></Creatives><Extensions><Extension type="FreeWheel"><CreativeParameters xmlns:ns2="http://www.yospace.com/extension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><CreativeParameter creativeId="7146157" name="_fw_advertiser_name" type="Linear">Google AdX</CreativeParameter><CreativeParameter creativeId="7146157" name="creativeApi_apiFramework" type="Linear">VPAID</CreativeParameter><CreativeParameter creativeId="7146157" name="ias_parameters" type="Linear">anID=928791;reqNetworkId=48804;adNetworkId=48804;advertiserId=692337;campaignId=29357571;ioId=29357572;ioExternalId=;placementId=46483868;adUnitId=13524;seriesId=;assetId=301758467;assetCustomId=me73b284b6e13af35fd5f8fbb62be3f900f30ddf78;siteId=g58309;sectionId=1331469;creativeId=7146157;renditionId= 30277731;renditionDuration=30;timePositionClass=preroll;pageType=;slotDim=0x0;slotId=0.0.0.1145512140;prof=48804:cnn_web_vod;cpxInd=cpx-non;transId=1628276478750598983;custom=;custom2=</CreativeParameter><CreativeParameter creativeId="7146157" name="industry" type="Linear"/><CreativeParameter creativeId="7146157" name="moat_callback" type="Linear">https://bea4.cnn.com/ad/l/1?s=e39af&amp;n=48804%3B48804%3B151933%3B187827%3B188286%3B193466%3B372496%3B375524%3B375613%3B375617%3B375620%3B376521%3B378491%3B379619%3B380903%3B381963%3B382114%3B382283%3B382314%3B382315%3B384777%3B499607%3B505334%3B510702%3B510839%3B512029%3B515018%3B516274&amp;t=1628276478750598983&amp;f=262144&amp;r=48804&amp;adid=46483869&amp;reid=30277731&amp;arid=0&amp;iw=&amp;uxnw=48804&amp;uxss=sg804421&amp;uxct=4&amp;absid=&amp;trigid=&amp;et=i&amp;cn=concreteEvent</CreativeParameter><CreativeParameter creativeId="7146157" name="moat_on_youtube" type="Linear">48804;48804;692337;29357571;29357572;;46483868;13524;;g58309;1331469;301758467;me73b284b6e13af35fd5f8fbb62be3f900f30ddf78;7146157;30277731;30;preroll;;48804:cnn_web_vod;cpx-non;1628276478750598983;</CreativeParameter></CreativeParameters></Extension></Extensions></InLine></Ad></VAST>';

    return 'data:text/xml,' + encodeURIComponent(vastXMLString);
  }

  static buildVastDocument(ad: VASTAd): Document {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    const vastVersion = ad.vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + ad.vastXML.outerHTML + '</VAST>';
    const xmlDoc = new DOMParser().parseFromString(vastXMLString, 'text/xml');
    return xmlDoc;
  }

  static companionAdFromVastResponse(response: VAST.VastResponse): VAST.VastCompanionAd [] {
    let vastCompanionAds: VAST.VastCompanionAd[] = [];
    let ad: VAST.VastAd = response.ads[0];
    if (!ad) {
      return vastCompanionAds;
    }

    // @ts-ignore
    let companionAds = ad.creatives.filter(value => value.type === 'companion');
    if (companionAds) {
      companionAds.forEach((vastCompanionAd: VAST.VastCreativeCompanion) => {
        if (vastCompanionAd.variations && vastCompanionAd.variations.length > 0) {
          Logger.log('Found Companion Ad: ' + stringify(vastCompanionAd));
          vastCompanionAds =  vastCompanionAds.concat(vastCompanionAd.variations);
        }
      });
    }

    return vastCompanionAds;
  }

  static parseVastResponse(vastResponse: VAST.VastResponse): YospaceCompanionAd [] {
    let yospaceCompanionAds: YospaceCompanionAd[] = [];
    let creativeView: string[];
    let companions: VAST.VastCompanionAd[] = VastHelper.companionAdFromVastResponse(vastResponse);
    if (companions == null) {
      return yospaceCompanionAds;
    }
    companions.forEach((companion: VAST.VastCompanionAd) => {
      Logger.log(
        'Companion ad found: id=' + companion.id + ' height=' + companion.height + ' width=' + companion.width);
      if (companion.trackingEvents) {
        creativeView = companion.trackingEvents.creativeView;
      }
      let companionAdResource: CompanionAdResource;
      if (companion.staticResources && companion.staticResources.length > 0) {
        companionAdResource = {
          url: companion.staticResources[0].url,
          type: CompanionAdType.StaticResource,
        };
      } else if (companion.htmlResources && companion.htmlResources.length > 0) {
        companionAdResource = {
          url: companion.htmlResources[0],
          type: CompanionAdType.HtmlResource,
        };
      } else if (companion.iframeResources && companion.iframeResources.length > 0) {
        companionAdResource = {
          url: companion.iframeResources[0],
          type: CompanionAdType.IFrameResource,
        };
      }

      yospaceCompanionAds.push({
        id: companion.id,
        height: +companion.height,
        width: +companion.width,
        adSlotId: companion.adSlotId,
        resource: companionAdResource,
        creativeTrackingEvents: creativeView,
        companionClickThroughURLTemplate: companion.companionClickThroughURLTemplate,
        companionClickTrackingURLTemplates: companion.companionClickTrackingURLTemplates,
      } as YospaceCompanionAd);
    });

    return yospaceCompanionAds;
  }

  static removeXmlNodes(names: string[], xml: Element) {
    names.forEach((name) => {
      const elements = xml.getElementsByTagName(name);
      for (let index = elements.length - 1; index >= 0; index--) {
        elements[index].parentNode.removeChild(elements[index]);
      }
    });
  }
}
