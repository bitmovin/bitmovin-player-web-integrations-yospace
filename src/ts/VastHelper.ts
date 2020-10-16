///<reference path="Yospace.d.ts"/>
///<reference path="VAST.d.ts"/>

import X2JS = require('x2js');
import { CompanionAdResource, CompanionAdType, YospaceCompanionAd } from './BitmovinYospacePlayerAPI';
import { Logger } from './Logger';
import stringify from 'fast-safe-stringify';

export class VastHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
    });
  }

  static buildDataUriWithoutTracking(ad: VASTAd): string {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    const vastXML = ad.vastXML;
    const trackingEvents = ['TrackingEvents', 'Tracking'];
    this.removeXmlNodes(trackingEvents, vastXML);
    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
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
          url: companion.staticResources[0],
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
