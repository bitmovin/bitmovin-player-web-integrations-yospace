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

function updateWithPlatformSpecificConfig(conf) {
  return conf;
}

function updateWithPlatformSpecificSourceConfig(source) {
  return source;
}

var platformType = 'web';
