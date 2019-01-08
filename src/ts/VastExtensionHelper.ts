///<reference path="Yospace.d.ts"/>
import X2JS = require('x2js');

export class VastExtensionHelper {

  static getExtensions(ad: VASTAd): any[] {
    let extensions: any[] = [];

    if (ad.Extensions.length > 0) {
      ad.Extensions.forEach((extension: XMLDocument) => {
        const jsObject: any = new X2JS({ arrayAccessFormPaths: [/./g] }).dom2js(extension);
        extensions.push(jsObject);
      });
    }

    return extensions;
  }
}
