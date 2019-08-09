///<reference path="Yospace.d.ts"/>
import X2JS = require('x2js');

export class VastHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
    });
  }

  static buildDataUri(ad: VASTAd): string {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    let vastXML = ad.vastXML;
    const trackingEvents = ['TrackingEvents', 'Tracking', 'Impression', 'Impression', 'ClickTracking',
      'IconClickTracking', 'NonLinearClickTracking'];
    this.removeXmlNodes(trackingEvents, vastXML);
    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    return 'data:text/xml,' + encodeURIComponent(vastXMLString);
  }

  static removeXmlNodes(names: string[], xml: Element) {
    names.forEach( (name) => {
      let elements = xml.getElementsByTagName(name);
      for (let index = elements.length - 1; index >= 0; index--) {
        elements[index].parentNode.removeChild(elements[index]);
      }
    });
  }
}
