# Bitmovin Player Yospace Integration Generic TV Sample

This folder contains a sample for how to use the Bitmovin Player Yospace Integration library on web-based TVs.

For Samsung Tizen or LG WebOS TVs, please refer to the specific respective examples, [../tizen/](../tizen/) and [../WebOS/](../WebOS/).

## Getting started

Run `npm run build-tv` (or `npm run build-tv:dev`) in the project root to build the library and copy all required files, including the sample web page and Javascript files, to the correct location in this folder.

Deploy the content of this folder, including subdirectories, to a web server and point your TV app to this. Exact details may vary depending on the TV platform.

Please note that changes in the `index.html` and `js/*` files will be overwritten by the build tooling, changes should be made in the [../web/\*](../web/) folder only.
