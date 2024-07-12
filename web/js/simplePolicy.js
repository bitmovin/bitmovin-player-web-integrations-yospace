var simplePolicy = {
  canMute: function () {
    return true;
  },
  canSeek: function () {
    return true;
  },
  canSeekTo: function (seekTarget) {
    return seekTarget;
  },
  canSkip: function () {
    return true;
  },
  canPause: function () {
    return true;
  },
  canChangePlaybackSpeed: function () {
    return true;
  },
};
