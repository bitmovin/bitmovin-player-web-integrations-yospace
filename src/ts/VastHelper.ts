///<reference path="Yospace.d.ts"/>
import X2JS = require('x2js');
import { VastAd, VastCompanionAd, VastCreative, VastCreativeCompanion, VastResponse } from 'vast-client';

export class VastHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
    });
  }

  static buildDataUriWithoutTracking(ad: VASTAd): string {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    const vastXML = ad.vastXML;
    const trackingEvents = ['TrackingEvents', 'Tracking', 'Impression', 'Impression', 'ClickTracking',
      'IconClickTracking', 'NonLinearClickTracking'];
    this.removeXmlNodes(trackingEvents, vastXML);
    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    return 'data:text/xml,' + encodeURIComponent(vastXMLString);
  }

  static buildVastDocument(ad: VASTAd): Document {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    const vastXML = ad.vastXML;
    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    const parser: DOMParser = new DOMParser();
    const xmlDoc = parser.parseFromString(vastXMLString, 'text/xml');
    return xmlDoc;
  }

  static companionAdFromVastResponse(response: VastResponse): VastCompanionAd | null {
    let vastCompanionAd: VastCompanionAd;
    let ad: VastAd = response.ads[0];
    if (ad) {
      let companionAds = ad.creatives.filter(value => value.type === 'companion');
      if (companionAds && companionAds.length > 0) {
        let companionAd = companionAds[0] as VastCreativeCompanion;
        console.log('Found Companion Ad: ' + JSON.stringify(companionAd));
        if (companionAd) {
          vastCompanionAd = companionAd.variations[0];
        }
      }
    }
    return vastCompanionAd;
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
