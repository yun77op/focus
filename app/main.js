'use strict';


/**
 * @enum {number}
 */
var SessionState = {
  quited: 0,
  started: 1,
  paused: 2
};

function startCtrl($scope) {
  $scope.interval = parseInt(localStorage.getItem('focus_interval'), 10) || 30;

  $scope.$watch('state', function(state) {
    switch (state) {
      case SessionState.started:
        $scope.started = true;
        $scope.paused = false;
        $scope.buttonText = 'Pause';
        progress.update();
        break;
      case SessionState.quited:
        $scope.paused = false;
        $scope.started = false;
        $scope.buttonText = 'Start';
        $scope.when =  $scope.interval * 60 * 1000;
        progress.clear();
        break;
      case SessionState.paused:
        $scope.paused = true;
        $scope.started = false;
        $scope.buttonText = 'Continue';
        progress.clear();
        break;
    }
    $scope.active = $scope.started || $scope.paused;
  });

  $scope.$watch('interval', function(interval) {
    localStorage.setItem('focus_interval', interval);
  });

  $scope.changeState = function() {
    var state;
    var data = {};

    if ($scope.paused) {
      data.continue = true;
      state = SessionState.started;
    } else if ($scope.started) {
      state = SessionState.paused;
    } else {
      state = SessionState.started;
      data.interval = $scope.interval * 60 * 1000;
    }

    data.state = $scope.state = state;

    var message = {
      type: 'session_state_change',
      data: data
    };
    chrome.runtime.sendMessage(message);
  };

  $scope.quit = function() {
    $scope.state = SessionState.quited;
    chrome.runtime.sendMessage({type: 'session_quit'});
  };


  var progress = (function($scope) {
    var progressTimer = null;

    return {
      update: function() {
        progressTimer = setInterval(function() {
          $scope.when -= 2000;
          if ($scope.when <= 0) {
            $scope.when = 0;
          }
          $scope.$apply();
          if ($scope.when == 0) {
            $scope.state = SessionState.quited;
          }
        }, 2000);
      },

      clear: function() {
        clearInterval(progressTimer);
      }
    };
  })($scope);


  chrome.runtime.sendMessage({
    type: 'session_query'
  }, function (response) {
    if (response) {
      $scope.interval = response.interval / 60 / 1000;
      $scope.state = response.state;
      $scope.when = response.when;
    } else {
      $scope.state = SessionState.quited;
    }

    $scope.$apply();
  });
}

