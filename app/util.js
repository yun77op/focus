'use strict';

var util = {};

util.getLocation = function(url) {
  var element = document.createElement('a');
  element.href = url;
  return element;
};

util.generateDateKey = function(prefix, isDay) {
  var date = new Date();
  return (prefix ? prefix : '') +
      date.getFullYear() + date.getMonth() +
      (isDay ? date.getDate() : '');
};