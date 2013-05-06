'use strict';

angular.module('focus-options', ['focus-services']).
  config(function($routeProvider) {
    $routeProvider.
      when('/', {
        controller: distractingCtrl,
        templateUrl: 'tpl/distracting.html'
      }).
      when('/activities', {
        controller: activitiesCtrl,
        templateUrl: 'tpl/activities.html'
      }).
      otherwise({redirectTo: '/'});
  });

function switchNav(eventOrElement) {
  var targetElement = angular.isElement(eventOrElement) ? eventOrElement : eventOrElement.currentTarget;
  var targetParentElement = targetElement.parentElement;
  $(targetParentElement).siblings().removeClass('active');
  targetParentElement.classList.add('active');
}


function distractingCtrl($scope, ServerJs) {
  switchNav(document.getElementById('focus-nav-distracting'));

  chrome.storage.local.get('distracting_urls', function(data) {
    $scope.urls = data.distracting_urls;
    $scope.$apply();
  });

  function syncUrls() {
    chrome.storage.local.set({
      distracting_urls: $scope.urls
    });
  }

  $scope.remove = function($event, url) {
    $event.preventDefault();
    $scope.urls = _.without($scope.urls, url);
    syncUrls();
    $event.currentTarget.parentElement.remove();
  };

  $scope.add = function() {
    var scope = $scope.$new();
    var $modal;

    function addUrl(url) {
      $scope.urls.push(url);
      syncUrls();
    }

    scope.submit = function() {
      $modal.modal('hide');
      addUrl(this.url);
    };

    ServerJs.modal('tpl/distracting-add-modal.html', scope, function($element) {
      $modal = $element;
    });
  };
}


function activitiesCtrl($scope) {
  switchNav(document.getElementById('focus-nav-activities'));

  var ctx = document.getElementById('focus-activities-chart').getContext('2d');
  var chart = new Chart(ctx);

  $scope.switchChartView = function($event, chartViewName) {
    if ($event) {
      $event.preventDefault();
      switchNav($event);
    }

    var keys = ['activities'];
    var isChartMonthView = chartViewName == 'month';
    if (isChartMonthView) {
      keys.push('month_to_day');
    }
    chrome.storage.local.get(keys, function(data) {
      var allActivities = data.activities;
      var dateKey = util.generateDateKey('date', true);
      var activities;

      if (isChartMonthView) {
        activities = {};
        data.month_to_day && data.month_to_day.values.forEach(function(dateKey) {
          _.each(allActivities && allActivities[dateKey], function(activity, url) {
            if (_.isUndefined(activities[url])) {
              activities[url] = _.extend({}, activity);
            } else {
              activities[url].time += activity.time;
            }
          });
        });
      } else {
        activities = allActivities && allActivities[dateKey];
      }

      if (!activities) {
        ctx.clearRect(0, 0, 700, 500);
        ctx.fillStyle = '#000';
        ctx.fillText('No data', 350, 250);
        return;
      }

      var chartData = {
        labels: [], datasets: [
          {
            fillColor : "rgba(151,187,205,0.5)",
            strokeColor : "rgba(151,187,205,1)",
            pointColor : "rgba(151,187,205,1)",
            pointStrokeColor : "#fff",
            data: []
          }
        ]};
      var activityArray = _.values(activities);

      activityArray.sort(function (a, b) {
        return b.time - a.time;
      }).slice(0, 7).forEach(function (activity) {
          chartData.labels.push(activity.url);
          chartData.datasets[0].data.push(Math.round(activity.time / 60 / 60 / 1000));
        });

      chart.Bar(chartData, {
        scaleLabel : "<%=value%>h"
      });

    });
  };

  $scope.switchChartView(null, 'today');
}