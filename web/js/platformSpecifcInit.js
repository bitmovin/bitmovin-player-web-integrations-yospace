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

function addPlatformSpecificConfig(conf) {
  return conf;
}
