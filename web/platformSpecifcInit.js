var platformReadyForPlayerPromise = (function () {
  if (navigator.serviceWorker) {
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(registrations.map((registration) => registration.unregister())).then(() => {
        // ensure Promise<void> is returned
      });
    });
  } else {
    return Promise.resolve();
  }
})();

function updateWithPlatformSpecificConfig(config) {
  config.playback = config.playback || {};
  // default muted to true as many browser block unmuted autoplay
  config.playback.muted = true;
  return config;
}

function updateWithPlatformSpecificSourceConfig(source) {
  return source;
}

var platformType = 'web';
