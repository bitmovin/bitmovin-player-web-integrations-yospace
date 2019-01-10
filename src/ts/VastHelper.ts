///<reference path="Yospace.d.ts"/>
import X2JS = require('x2js');

export class VastHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
    });
  }

  static buildVastXml(ad: VASTAd): string {
    // build a valid VAST xml data uri to schedule only the current vpaid ad
    return 'data:text/xml,' + encodeURIComponent('<VAST version="3.0">'+ad.vastXML.outerHTML+'</VAST>');
  }
}
