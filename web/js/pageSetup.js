var customStreamButton = $('#load-custom-steam');

function createLogFromEvent(event) {
  var timestamp = new Date(event.timestamp).toISOString();
  var playheadTime = event.time ? '@' + event.time : '@?';
  var msg = '[' + timestamp + '][BYP][' + event.type + playheadTime + ']:' + JSON.stringify(event);
  return msg;
}

function setupTestPage() {
  document.querySelector('#option-close').addEventListener('click', function () {
    yospacePlayer.unload();
    deselectCustomLoadButton();
  });
  var startIndex = 1;
  var nextIndex = createSourceList('vod', 'predefined-sources', startIndex);
  createSourceList('linear', 'predefined-sources', nextIndex);

  setupTable();

  applyQueryParameters();

  customStreamButton.on('click', function () {
    $(customStreamButton).addClass('active');

    // remove active button of group
    $($('.btn-group-toggle .active')[0]).removeClass('active');
    var customSource = {
      title: 'Custom Stream',
      hls: $('#steam-stream-url').val(),
    };

    var customStreamTypeSelect = $('#stream-type-select');
    if (customStreamTypeSelect.val() === '1') {
      customSource.assetType = bitmovin.player.ads.yospace.YospaceAssetType.VOD;
    } else if (customStreamTypeSelect.val() === '2') {
      customSource.assetType = bitmovin.player.ads.yospace.YospaceAssetType.LINEAR;
    }

    yospacePlayer.unload();
    yospacePlayer.load(modifySourceBeforeLoading(customSource));
  });
}

function applyQueryParameters() {
  $.urlParam = function (name) {
    var results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results == null) {
      return null;
    } else {
      return decodeURI(results[1]) || 0;
    }
  };

  if ($.urlParam('validation')) {
    isValidationMode = $.urlParam('validation').toLowerCase() === 'true';
  }

  if ($.urlParam('debug')) {
    debugOverride = $.urlParam('debug').toLowerCase() === 'true';
  }

  if ($.urlParam('autoplay')) {
    autoplay = $.urlParam('autoplay').toLowerCase() === 'true';
  }

  if ($.urlParam('aggressiveVpaid')) {
    aggressiveVpaid = $.urlParam('aggressiveVpaid').toLowerCase() === 'true';
  }

  if ($.urlParam('vpaid')) {
    vpaid = $.urlParam('vpaid').toLowerCase() === 'true';
  }

  if ($.urlParam('autoLoadSource')) {
    var sourceNumber = parseInt($.urlParam('autoLoadSource'));
    autoLoadSource = !Number.isNaN(sourceNumber) ? sourceNumber : -1;
  }
}

function overrideSourceAdKvps(source) {
  var overrideEl = document.getElementById('tearsheet-override');
  if (overrideEl.value === '0') {
    return source;
  }

  source.hls = source.hls + '&tearsheet=' + overrideEl.value;
  return source;
}

function modifySourceBeforeLoading(source) {
  source = overrideSourceAdKvps(source);
  return updateWithPlatformSpecificSourceConfig(source);
}

function createSourceList(streamType, containerId, index) {
  var sourceList = document.querySelector('#' + containerId);
  Object.keys(sources[streamType]).forEach(function (source) {
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'options';
    input.id = source;
    input.autocomplete = 'off';

    var label = document.createElement('label');
    label.classList.add('btn');
    label.classList.add('btn-outline-secondary');
    label.innerText =
      index + ': ' + streamType.toUpperCase() + ': ' + (sources[streamType][source].title ? sources[streamType][source].title : source);
    index++;
    label.onclick = function (event) {
      var sourceId = source.substring(source.indexOf(': '));
      yospacePlayer.load(modifySourceBeforeLoading(sources[streamType][sourceId]));
      deselectCustomLoadButton();
    };

    label.appendChild(input);

    sourceList.appendChild(label);
  });

  return index;
}

function log(message) {
  if (isValidationMode) return;
  console.log(message);
}

function debug(message) {
  if (isValidationMode) return;
  console.debug(message);
}

function deselectCustomLoadButton() {
  $(customStreamButton).removeClass('active');
}

// NOTE: Doing a deep clone using the JSON stringify/parse
// does incorrectly clone some objects:
// https://stackoverflow.com/a/122704
//
// In general we're deep cloning the events to ensure no lower level
// state mutations are picked up later and the console log
// output incorrectly represents the data
function cloneDeepSimple(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setupTable() {
  var table = $('#adEventTable');
  var header = $('<thead/>');
  var row = $('<tr/>');
  row.append($('<th/>').text('AdBreakStart'));
  row.append($('<th/>').text('AdStart'));
  row.append($('<th/>').text('AdFinished'));
  row.append($('<th/>').text('AdBreakFinished'));
  header.append(row);
  table.append(header);
}

function updateAdEventTable() {
  if (adBreakState.abs > 0) {
    var table = $('#adEventTable');
    let body = $('<tbody/>');
    $('#adEventTable tbody').remove();
    table.append(body);
    var row = $('<tr>');
    row.append($('<td/>').text(adBreakState.abs));
    row.append($('<td/>').text(adBreakState.as));
    row.append($('<td/>').text(adBreakState.af));
    row.append($('<td/>').text(adBreakState.abf));
    body.append(row);
  }
}

function timeChangedAdHandler(adBreak, ad, eventTime) {
  if (adBreak && ad) {
    let duration = adBreak.duration;
    let adCounter = 0;
    let adDuration = 0;
    for (let i = 0; i < adBreak.ads.length; i++) {
      adCounter = i + 1;
      let a = adBreak.ads[i];
      if (a.id === ad.id && ad.sequence === a.sequence) {
        adDuration = a.duration - eventTime;
        duration = duration - eventTime;
        break;
      } else {
        duration = duration - a.duration;
      }
    }

    $('#adBreakLabel').text('AdBreak: ' + Number(duration).toFixed(2) + 's remaining');
    $('#adLabel').text('Ad ' + adCounter + ' of ' + adBreak.ads.length + ': ' + Number(adDuration).toFixed(2) + 's remaining');
  } else {
    $('#adBreakLabel').text('AdBreak: false');
    $('#adLabel').text('Ad: false');
  }
}

function adStartedHandler(activeAdBreak, activeAd) {
  var table = $('#adTable');
  var header = $('<thead/>');
  // var row = $('<tr/>')
  var row2 = $('<tr/>');
  row2.append($('<th/>').text('Id'));
  row2.append($('<th/>').text('Duration'));
  row2.append($('<th/>').text('VPAID'));
  row2.append($('<th/>').text('Sequence'));
  header.append(row2);
  table.append(header);
  let body = $('<tbody/>');
  table.append(body);
  for (let i = 0; i < activeAdBreak.ads.length; i++) {
    let ad = activeAdBreak.ads[i];
    var row = $('<tr>');
    row.append($('<td/>').text(ad.id));
    row.append($('<td/>').text(ad.duration));
    row.append($('<td/>').text(!ad.uiConfig.requestsUi));
    row.append($('<td/>').text(ad.sequence));
    if (ad.id === activeAd.id && ad.sequence === activeAd.sequence) {
      row.addClass('table-active');
    }

    body.append(row);
  }
}

function displayCompanionAd(event) {
  if (event.ad && event.ad.companionAds && event.ad.companionAds.length > 0) {
    var linkElement = document.createElement('a');
    linkElement.href = event.ad.companionAds[0].companionClickThroughURLTemplate;
    var img = new Image(event.ad.companionAds[0].width, event.ad.companionAds[0].height);
    img.src = event.ad.companionAds[0].resource.url;
    linkElement.appendChild(img);
    document.getElementById('companionDiv').appendChild(linkElement);
  }
}

function hideCompanionAd() {
  var companion = document.getElementById('companionDiv');
  while (companion.firstChild) {
    companion.removeChild(companion.firstChild);
  }
}

setupTestPage();
