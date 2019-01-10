///<reference path="Yospace.d.ts"/>
import X2JS = require('x2js');

export class VastExtensionHelper {

  static getExtensions(ad: VASTAd): any[] {
    return ad.Extensions.map((extension: XMLDocument) => {
      return new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
    });
  }
}
