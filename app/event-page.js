'use strict';

var HTTP_PATTERN = /^https?:\/\//;
var focus = {};

/**
 * @namespace
 * @type {{}}
 */
focus.focusSession = {};

focus.focusSession.activeFocusSession_ = null;


focus.focusSession.storeFocusSession = function() {
  if (focus.focusSession.activeFocusSession_) {
    chrome.storage.local.set({
      focus_session: focus.focusSession.activeFocusSession_.toJSON()
    });
  }
};

focus.focusSession.quitFocusSession = function() {
  focus.focusSession.getFocusSession(function(focusSession) {
    focusSession.quit();
    focus.focusSession.activeFocusSession_ = null;
    chrome.storage.local.remove(['focus_session', 'dismissed_urls'], function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
    });
  });
};

/**
 *
 * @param {Function} callback
 * @param {Object=} opt_options
 * @returns {*}
 */
focus.focusSession.getFocusSession = function(callback, opt_options) {
  if (focus.focusSession.activeFocusSession_) {
    return callback(focus.focusSession.activeFocusSession_);
  }
  chrome.storage.local.get('focus_session', function(data) {
    var options = data.focus_session || opt_options;
    var focusSession = null;
    if (options) {
      focusSession = focus.focusSession.activeFocusSession_ = new FocusSession(options);
    }
    callback(focusSession);
  });
};

focus.focusSession.handleFocusSessionStateChange = function(data) {
  switch (data.state) {
    case SessionState.started:
      focus.focusSession.getFocusSession(function(focusSession) {
        focusSession.setState(SessionState.started);
      }, {
        interval: data.interval
      });
      break;

    case SessionState.paused:
      focus.focusSession.getFocusSession(function(focusSession) {
        focusSession.pause();
      });
      break;

    case SessionState.quited:
      focus.focusSession.quitFocusSession();
      break;
  }
};

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.type) {
      case 'session_state_change':
        focus.focusSession.handleFocusSessionStateChange(request.data);
        break;

      case 'session_quit':
        focus.focusSession.quitFocusSession();
        break;

      case 'session_query':
        focus.focusSession.getFocusSession(function(focusSession) {
          var response = focusSession ? focusSession.toJSON() : null;
          sendResponse(response);
        });
        return true;

      case 'close_current_tab':
        chrome.tabs.remove(sender.tab.id);
    }
  });

chrome.runtime.onSuspend.addListener(function() {
  focus.focusSession.storeFocusSession();
});


/**
 * @namespace
 * @type {{}}
 */
focus.contentScript = {};

focus.contentScript.insert = function(tab) {
  focus.focusSession.getFocusSession(function(focusSession) {
    if (!focusSession || !focusSession.isActive) return;

    focus.contentScript.identifyDistractingUrl(tab.url, function(result) {
      if (result) chrome.tabs.executeScript(tab.id, {file: "app/content-script.js"});
    });
  });
};

focus.contentScript.identifyDistractingUrl = function(targetUrl, callback) {
  chrome.storage.local.get(['dismissed_urls', 'distracting_urls'], function(data) {
    var result = false;
    var url;
    targetUrl = util.getLocation(targetUrl).hostname;
    if (data.distracting_urls) {
      for (var i = 0, l = data.distracting_urls.length; i < l; ++i) {
        url = data.distracting_urls[i];
        if (~targetUrl.indexOf(url) &&
            (!data.dismissed_urls || !data.dismissed_urls[targetUrl])) {
          result = true;
          break;
        }
      }
    }
    callback(result);
  });
};


chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (!tab.url || !tab.url.match(HTTP_PATTERN)) return;
    focus.contentScript.insert(tab);
  });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status == 'loading') {
    if (!tab.url || !tab.url.match(HTTP_PATTERN)) return;
    focus.contentScript.insert(tab);
  }
});


var cacheStorage = function(data, metaData, callback) {
  var keys = Object.keys(metaData);
  chrome.storage.local.get(keys, function(aData) {
    _.extend(data, metaData, aData);
    callback();
  });

  chrome.runtime.onSuspend.addListener(function persist() {
    chrome.storage.local.set(data);
  });
};


focus.tab = (function() {

  // cached data
  var data = {};

  function initialize() {
    var metaData = {
      window_to_activity: {},
      activities: {},
      month_to_day: {key: null, values: []},
      previousFocusedWindowId: null
    };

    cacheStorage(data, metaData, function() {
      chrome.windows.onRemoved.addListener(function(windowId) {
        var activity = data.window_to_activity[windowId];
        stopTrackUrl(activity);
        delete data.window_to_activity[windowId];
        if (data.previousFocusedWindowId == windowId) {
          data.previousFocusedWindowId = null;
          data.window_to_activity = {};
        }
      });

      chrome.windows.onFocusChanged.addListener(function(windowId) {
        if (data.previousFocusedWindowId) {
          stopTrackUrl(data.window_to_activity[data.previousFocusedWindowId]);
        }
        if (windowId == chrome.windows.WINDOW_ID_NONE) {
          data.previousFocusedWindowId = null;
          return;
        }

        data.previousFocusedWindowId = windowId;
        chrome.windows.get(windowId, function (window) {
          if (window.type == 'normal') {
            var lastActivity = data.window_to_activity[windowId];
            if (lastActivity) {
              data.window_to_activity[windowId] = startTrackUrl(lastActivity.url);
            }
          }
        });
      });

      chrome.tabs.onActivated.addListener(function(activeInfo) {
        var windowId = activeInfo.windowId;
        chrome.windows.get(windowId, function(window) {
          if (!window.focused) return;

          stopTrackUrl(data.window_to_activity[windowId]);
          chrome.tabs.get(activeInfo.tabId, function(tab) {
            data.window_to_activity[windowId] = startTrackUrl(tab.url, true);
          });
        });
      });


      chrome.windows.getCurrent({populate: true}, function(window) {
        data.previousFocusedWindowId = window.id;
        var activeTab = _.find(window.tabs, function(tab) {
          return tab.active;
        });
        if (activeTab.url) {
          data.window_to_activity[window.id] = startTrackUrl(activeTab.url, true);
        }
      });
    });
  }


  function processMonthData(day, month) {
    var monthToDay = data.month_to_day;
    if (typeof monthToDay.key == 'undefined') monthToDay.key = month;
    var lastActiveMonth = monthToDay.key;
    var allActivities = data.activities;
    if (lastActiveMonth != month) {
      monthToDay.key = month;

      // remove
      monthToDay.values.forEach(function (day) {
        delete allActivities[day];
      });

      monthToDay.values = [];
    }

    var lastDay = _.last(monthToDay.values);
    if (!lastDay || lastDay != day) {
      monthToDay.values.push(day);
    }

    data.month_to_day = monthToDay;
  }

  function startTrackUrl(url, raw) {
    if (raw) {
      if (!url || !url.match(HTTP_PATTERN)) return null;
      url = util.getLocation(url).host;
    }

    var day = util.generateDateStr('date', true);
    var month = util.generateDateStr('', false);
    var allActivities = data.activities;
    var activities = allActivities[day] || {};

    var activity = activities[url] || {duration: 0, url: url};
    activity.startTime = Date.now();
    activity.day = day;
    activity.month = month;

    return activity;
  }

  /**
   * @param activity {?Object}
   */
  function stopTrackUrl(activity) {
    if (!activity) return;
    var month = util.generateDateStr('', false);
    var day = activity.day;
    var allActivities = data.activities;
    var activities = allActivities[day] || {};
    var now = Date.now();

    if (activity.month == month) {
      activity.duration += (now - activity.startTime);
      activity.startTime = now;
      activities[activity.url] = _.extend({}, activity);
      allActivities[day] = activities;
    }

    processMonthData(day, month);
  }

  return {
    initialize: initialize
  };

})();

focus.tab.initialize();


chrome.storage.local.get(function (data) {
  if (!data.distracting_urls) {
    chrome.storage.local.set({
      distracting_urls: ['weibo.com', 'qzone.qq.com', 't.qq.com', 'taobao.com', 'jd.com']
    });
  }
});