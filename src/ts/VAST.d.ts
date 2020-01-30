// Type definitions for vast-client 2.1
// Project: https://github.com/dailymotion/vast-client-js#readme
// Definitions by: John G. Gainfort Jr. <https://github.com/jgainfort>, Sara Nordmyr da Cunha
// <https://github.com/kobawan> Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped TypeScript Version: 2.8

declare namespace VAST {
  class VASTTracker extends EventEmitter {
    /**
     * The VAST tracker constructor will process the tracking URLs of the selected ad/creative and returns an instance
     * of VASTTracker.
     */
    constructor(
      /**
       * An optional instance of VASTClient that can be updated by the tracker.
       */
      client: VASTClient | null,
      /**
       * The ad of the selected mediaFile to track
       */
      ad: VastAd,
      /**
       * The creative of the selected mediaFile to track
       */
      creative: VastCreativeLinear,
      /**
       * An optional variation of the creative, for Companion and NonLinear Ads
       */
      variation?: VastCreativeCompanion | VastCreativeNonLinear,
    );

    /**
     * Sets the duration of the ad and updates the quartiles based on that.
     */
    setDuration(duration: number): void;

    /**
     * Update the current time value.
     * This is required for tracking time related events such as start, firstQuartile, midpoint, thirdQuartile or
     * rewind.
     */
    setProgress(
      /**
       * Current playback time in seconds.
       */
      progress: number,
    ): void;

    /**
     * Update the mute state and call the mute/unmute tracking URLs. Emit a mute or unmute event.
     */
    setMuted(
      /**
       * Indicate if the video is muted or not.
       */
      muted: boolean,
    ): void;

    /**
     * Update the pause state and call the resume/pause tracking URLs. Emit a resume or pause event.
     */
    setPaused(
      /**
       * Indicate if the video is paused or not.
       */
      paused: boolean,
    ): void;

    /**
     * Update the fullscreen state and call the fullscreen tracking URLs. Emit a fullscreen or exitFullscreen event.
     */
    setFullscreen(
      /**
       * Indicate the fullscreen mode.
       */
      fullscreen: boolean,
    ): void;

    /**
     * Update the expand state and call the expand/collapse tracking URLs. Emit a expand or collapse event
     */
    setExpand(
      /**
       * Indicate if the video is expanded or no
       */
      expanded: boolean,
    ): void;

    /**
     * Must be called if you want to overwrite the <Linear> Skipoffset value. This will init the skip countdown
     * duration. Then, every time you call setProgress(), it will decrease the countdown and emit a skip-countdown
     * event with the remaining time. Do not call this method if you want to keep the original Skipoffset value.
     */
    setSkipDelay(
      /**
       * The time in seconds until the skip button is displayed.
       */
      duration: number,
    ): void;

    /**
     * Report the impression URI. Can only be called once. Will report the following URI:
     *
     * - All <Impression> URI from the <InLine> and <Wrapper> tracking elements.
     * - The creativeView URI from the <Tracking> events
     *
     * Once done, a creativeView event is emitted.
     */
    trackImpression(): void;

    /**
     * Send a request to the URI provided by the VAST <Error> element. If an [ERRORCODE] macro is included, it will be
     * substitute with code.
     */
    errorWithCode(
      /**
       * Replaces [ERRORCODE] macro. [ERRORCODE] values are liste in the VAST specification.
       */
      errorCode: string,
    ): void;

    /**
     * Must be called when the user watched the linear creative until its end. Call the complete tracking URLs.
     * Emit a complete events when done.
     */
    complete(): void;

    /**
     * Must be called when the player or the window is closed during the ad. Call the closeLinear (in VAST 3.0) and
     * close tracking URLs. Emit a closeLinear or a close event when done.
     */
    close(): void;

    /**
     * Must be called when the skip button is clicked. Call the skip tracking URLs. Emit a skip event when done.
     */
    skip(): void;

    /**
     * Must be called when the user clicks on the creative. Call the tracking URLs.
     * Emit a clickthrough event with the resolved clickThrough URL when done.
     */
    click(): void;
  }

  class VASTClient {
    constructor(
      /**
       * Used for ignoring the first n calls. Automatically reset 1 hour after the 1st ignored call. Free Lunch capping
       * is disable if sets to 0. Default: 0
       */
      cappingFreeLunch?: number,
      /**
       * Used for ignoring calls that happen n ms after the previous call. Minimum time interval is disabled if sets to
       * 0. Default: 0
       */
      cappingMinimumTimeInterval?: number,
      /**
       * Optional custom storage to be used instead of the default one
       */
      customStorage?: VASTClientCustomStorage,
    );

    cappingFreeLunch: number;
    cappingMinimumTimeInterval: number;
    storage: VASTClientCustomStorage | Storage;

    /**
     * Fetch a URL and parse the response into a valid VAST object.
     *
     * @param url Contains the URL for fetching the VAST XML document.
     * @param options An optional set of key/value to configure the Ajax request
     */
    get(url: string, options?: VastRequestOptions): Promise<VastResponse>;

    /**
     * Returns a boolean indicating if there are more ads to resolve for the current parsing.
     */
    hasRemainingAds(): boolean;

    /**
     * Resolves the next group of ads. If all is true resolves all the remaining ads.
     */
    getNextAds(all?: boolean): Promise<VastResponse>;

    /**
     * Returns the instance of VASTParser used by the client to parse the VAST.
     * Use it to directly call a method provided by the VASTParser class.
     */
    getParser(): VASTParser;
  }

  class EventEmitter {
  }

  class VASTParser {
    /**
     * Parses the given xml Object into a VASTResponse.
     * Returns a Promise which either resolves with the fully parsed VASTResponse or rejects with an Error.
     */
    parseVAST(
      /**
       * A VAST XML document
       */
      vastXml: Document,
      /**
       * An optional Object of parameters to be used in the parsing process.
       */
      options?: VastRequestOptions,
    ): Promise<VastResponse>;
  }

  interface VASTClientCustomStorage {
    getItem(key: string): string | null;

    setItem(key: string, val: string): void;

    [key: string]: any | (() => any);
  }

  function UrlHandlerCbType(err: null, xml: XMLDocument): void;
  function UrlHandlerCbType(err: Error): void;

  interface VASTClientUrlHandler {
    get(
      url: string,
      options: { timeout: number, withCredentials: boolean },
      cb: typeof UrlHandlerCbType,
    ): void;
  }

  interface VastRequestOptions {
    /**
     * A custom timeout for the requests (default 0)
     */
    timeout?: number;
    /**
     * A boolean to enable the withCredentials options for the XHR and FLASH URLHandlers (default false)
     */
    withCredentials?: boolean;
    /**
     * A number of Wrapper responses that can be received with no InLine response (default 0)
     */
    wrapperLimit?: number;
    /**
     * Custom urlhandler to be used instead of the default ones urlhandlers
     */
    urlHandler?: VASTClientUrlHandler;
    /**
     * Allows you to parse all the ads contained in the VAST or to parse them ad by ad or adPod by adPod (default true)
     */
    resolveAll?: boolean;
  }

  interface VastResponse {
    ads: VastAd[];
    errorURLTemplates: string[];
  }

  interface VastError {
    /**
     * Whenever an error occurs during the VAST parsing, the parser will call on its own all related tracking error
     * URLs. Reported errors are: no_ad: The VAST document is empty VAST error 101: VAST schema validation error. VAST
     * error 301: Timeout of VAST URI provided in Wrapper element. VAST error 302: Wrapper limit reached. VAST error
     * 303: No VAST response after one or more Wrappers.
     */
    ERRORCODE: string | number;
    ERRORMESSAGE?: string;
    extensions?: VastAdExtension[];
    system?: VastSystem | string | null;
  }

  interface VastCreative {
    id: string | null;
    adId: string | null;
    trackingEvents: VastTrackingEvents;
    apiFramework: string | null;
    sequence: string | number | null;
    type: string;
  }

  interface VastCreativeLinear extends VastCreative {
    adParameters: string | null;
    duration: number;
    icons: VastIcon[];
    mediaFiles: VastMediaFile[];
    skipDelay: number | null;
    videoClickThroughURLTemplate: string | null;
    videoClickTrackingURLTemplates: string[];
    videoCustomClickURLTemplates: string[];
  }

  interface VastCreativeNonLinear extends VastCreative {
    variations: VastNonLinearAd[];
  }

  interface VastCreativeCompanion extends VastCreative {
    variations: VastCompanionAd[];
  }

  interface VastAd {
    advertiser: string | null;
    creatives: VastCreative[];
    description: string | null;
    errorURLTemplates: string[];
    extensions: VastAdExtension[];
    id: string | null;
    impressionURLTemplates: string[];
    pricing: string | null;
    sequence: string | null;
    survey: string | null;
    system: VastSystem | string | null;
    title: string | null;
  }

  interface VastAdExtension {
    attributes: VastAdAttributes;
    children: VastAdExtensionChild[];
  }

  interface VastAdAttributes {
    type: string;
    fallback_index: string | null;
  }

  interface VastAdExtensionChild {
    attributes: VastAdChildAttributes;
    name: string | undefined;
    value: string | number;
  }

  interface VastAdChildAttributes {
    [key: string]: any;
  }

  interface VastNonLinearAd {
    nonLinearClickTrackingURLTemplates: string[];
    nonLinearClickThroughURLTemplate: string | null;
    adParameters: string | null;
    type: string | null;
    iframeResource: string | null;
    htmlResource: string | null;
    id: string | null;
    width: string;
    height: string;
    expandedWidth: string;
    expandedHeight: string;
    scalable: boolean;
    maintainAspectRatio: boolean;
    minSuggestedDuration: number;
    apiFramework: string;
    staticResource: string | null;
  }

  interface VastCompanionAd {
    companionClickThroughURLTemplate: string | null;
    companionClickTrackingURLTemplate: string | null | undefined;
    companionClickTrackingURLTemplates: string[];
    height: string;
    htmlResources: string [];
    id: string | null;
    adSlotId: string | null;
    iframeResources: string [];
    staticResources: string [];
    trackingEvents: VastCompanionTrackingEvents;
    type: string | null;
    width: string;
    altText: string | null;
  }

  interface VastCompanionTrackingEvents {
    creativeView: string[];

    [key: string]: string[];
  }

  interface VastMediaFile {
    apiFramework: string | null;
    bitrate: number;
    codec: string | null;
    deliveryType: string;
    fileURL: string | null;
    height: number;
    id: string | null;
    maintainAspectRatio: boolean | null;
    maxBitrate: number;
    mimeType: string | null;
    minBitrate: number;
    scalable: boolean | null;
    width: number;
  }

  interface VastTrackingEvents {
    complete: string[];
    firstQuartile: string[];
    midpoint: string[];
    thirdQuartile: string[];

    [key: string]: string[];
  }

  interface VastSystem {
    value: string;
    version: string | null;
  }

  interface VastIcon {
    program: string | null;
    height: number;
    width: number;
    xPosition: number;
    yPosition: number;
    apiFramework: string | null;
    offset: string | null;
    duration: number;
    type: string | null;
    staticResource: string | null;
    htmlResource: string | null;
    iframeResource: string | null;
    iconClickThroughURLTemplate: string | null;
    iconClickTrackingURLTemplates: string[];
    iconViewTrackingURLTemplate: string | null;
  }
}

