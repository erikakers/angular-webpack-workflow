import * as angular from 'angular';

import example from './example/example.directive.ts';
import template from './example/example.directive.html';

angular.module('app', [
  example
]);//.directive('exampleDirective', exampleDirective);

function exampleDirective() {
  const directive = {
    restrict: 'AE',
    scope: {},
    template: template,
    controllorAs: 'vm',
    controller: exampleController
  };

  return directive;
}

function exampleController() {
  const vm = this;
  vm.someValue = true;
}

