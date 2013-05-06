'use strict';

/**
 * @enum {number}
 */
var SessionState = {
  quited: 0,
  started: 1,
  paused: 2
};

/**
 * @class FocusSession
 * @param options
 * @constructor
 */
var FocusSession = function(options) {
  this.interval_ = options.interval;
  this.when_ = options.when || this.interval_;
  this.setState(options.state || SessionState.quited);

  this.__defineGetter__('isActive', function() {
    return this.state_ == SessionState.started;
  });
};

FocusSession.prototype.start = function() {
  var self = this;
  var now = Date.now();
  this.startTime_ = now;
  chrome.alarms.create('focus_session', {
    when: now + this.when_
  });

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name != 'focus_session') return;

    self.handleTimeUp_(alarm);
  });
};

FocusSession.prototype.handleTimeUp_ = function(alarm) {
  var notification = webkitNotifications.createNotification(
    '../icon48.png',  // icon url - can be relative
    'Focus time is up!',  // notification title
    'Go to rest for a while'  // notification body text
  );

  // Then show the notification.
  notification.show();

  this.setState(SessionState.quited);
};

FocusSession.prototype.clearAlarm_ = function() {
  chrome.alarms.clear('focus_session');
};

FocusSession.prototype.setState = function(state) {
  this.state_ = state;
  if (state == SessionState.started) {
    this.start();
    chrome.browserAction.setBadgeText({
      text: '1'
    });
  } else {
    chrome.browserAction.setBadgeText({
      text: ''
    });
  }
};

FocusSession.prototype.pause = function() {
  this.clearAlarm_();
  this.setState(SessionState.paused);
};

FocusSession.prototype.quit = function() {
  this.clearAlarm_();
  this.setState(SessionState.quited);
};


FocusSession.prototype.getRemainedTime = function() {
  return this.when_ - (Date.now() - this.startTime_);
};

FocusSession.prototype.toJSON = function() {
  return {
    interval: this.interval_,
    when: this.getRemainedTime(),
    state: this.state_
  };
};