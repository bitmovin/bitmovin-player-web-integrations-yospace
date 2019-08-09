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

    this.removeXmlNodes('TrackingEvents', vastXML);
    this.removeXmlNodes('Tracking', vastXML);
    this.removeXmlNodes('Impression', vastXML);
    this.removeXmlNodes('ClickTracking', vastXML);
    this.removeXmlNodes('IconClickTracking', vastXML);
    this.removeXmlNodes('NonLinearClickTracking', vastXML);

    console.log('Scheduling VPAID ad: ' + vastXML.outerHTML);

    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    return 'data:text/xml,' + encodeURIComponent(vastXMLString);
  }

  static removeXmlNodes(name: string, xml: Element) {
    var elements = xml.getElementsByTagName(name);
    for (var index = elements.length - 1; index >= 0; index--) {
      elements[index].parentNode.removeChild(elements[index]);
    }
  }

}
