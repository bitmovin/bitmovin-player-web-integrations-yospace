import { BitmovinYoSpacePlayer } from './YoSpaceAdManagement';

// Export YoSpace Ad Management to global namespace
let w = (window as any);
w.bitmovin = w.bitmovin || {};
w.bitmovin.player = w.bitmovin.player || {};
w.bitmovin.player.analytics = w.bitmovin.player.analytics || {};
w.bitmovin.player.analytics.ConvivaAnalytics = BitmovinYoSpacePlayer;
