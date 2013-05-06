'use strict';

angular.module('focus-services', []).
  factory('ServerJs', function($http, $compile) {
    var ServerJs = {};

    ServerJs.run = function(templateUrl, scope, opt_callback) {
      $http({method: 'GET', url: templateUrl, cache: true}).
        then(function(response) {
          var $element = $compile(response.data)(scope);
          $element.appendTo('body');
          opt_callback && opt_callback($element);
        });
      };

    ServerJs.modal = function(templateUrl, scope, opt_callback) {
      ServerJs.run(templateUrl, scope, function($element) {
        $element.modal('show');
        $element.on('hidden', function() {
          $element.remove();
        });
        opt_callback && opt_callback($element);
      });
    };

    return ServerJs;
  });