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
    const vastXML = ad.vastXML;
    const vastVersion = vastXML.parentElement.getAttribute('version');
    const vastXMLString = '<VAST version="' + vastVersion + '">' + vastXML.outerHTML + '</VAST>';
    return 'data:text/xml,' + encodeURIComponent(vastXMLString);
  }
}
