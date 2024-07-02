# Bitmovin Player Yospace Integration Tizen Sample

This folder contains a sample for how to use the Bitmovin Player Yospace Integration library in Samsung Tizen TV apps.

## Getting started

Run `npm run build-tv` (or `npm run build-tv:dev`) in the project root to build the library and copy all required files, including the sample web page and Javascript files, to the correct location in this folder.

Open this `tizen` folder in Tizen Studio or Visual Studio Code with the `tizen-tv` extension to create a signed package or launch directly as usual.

Please note that changes in the `tizen/index.html` and `tizen/js/*` files will be overwritten by the build tooling, changes should be made in the [../web/](../web/) folder only.

### Notes for developing your own app

Make sure to enable `file_protocol` and set your `app_id` in the `tweaks` section of your config. The `app_id` should be your `app_id`.

```
var conf = {
	key : "<YOUR_PLAYER_KEY>",
	source : {
		dash: "https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd"
	},
	playback : {
		autoplay : true
	},
	tweaks : {
		file_protocol : true,
		app_id : "Ff4zhu5kqV.TizenBitmovinYospacePlayer"
	}
};
```
