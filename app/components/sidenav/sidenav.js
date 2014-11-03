/*global $, window*/
angular.module('gsApp.sidenav', [
  'gsApp.workspaces.home',
  'ui.bootstrap',
  'gsApp.olmap'
])
.directive('sidenav', function() {
    return {
      restrict: 'EA',
      templateUrl: '/components/sidenav/sidenav.tpl.html',
      controller: 'SideNavCtrl',
      replace: true
    };
  })
.controller('SideNavCtrl', ['$scope', '$rootScope', 'GeoServer', 'AppEvent',
  '$state', '$log', '$timeout', '$window', 'AppSession', '$location',
  function($scope, $rootScope, GeoServer, AppEvent, $state, $log,
    $timeout, $window, AppSession, $location) {

    $scope.toggleWkspc = {}; // workspaces in wide sidenav
    $scope.toggleWkspc2 = {}; // workspaces in collapse sidenav

    // open any open workspace folders on refresh
    var alreadyOpen_ws = null, loc = $location.path();
    var index = loc.indexOf('workspace/');
    if (index > -1) {
      var workspaceSubstr = loc.substring(index+10);
      var lastindex = workspaceSubstr.indexOf('/');
      if (lastindex > -1) {
        alreadyOpen_ws = workspaceSubstr.substring(0, lastindex);
      }
    }

    // Hug partial menu to sidebar bottom if height's enough
    $scope.onWindowResize = function() {
      var windowHeight = $window.innerHeight - 150;
      if (windowHeight < 300) {
        $scope.sideStyle = {'position': 'relative'};
        $scope.sideBottom = {'position': 'relative'};
      } else {
        $scope.sideStyle = {'position': 'absolute'};
        $scope.sideBottom = {'top': (windowHeight-15) + 'px'};
      }
    };
    $scope.onWindowResize();
    var timer = null;
    $(window).resize(function() { // angular $window checked too often
      if (timer===null) {
        timer = $timeout(function() {
          $scope.onWindowResize();
          timer = null;
        }, 700);
      }
    });

    $scope.openWorkspaces = function() {
      if (!$scope.workspaces) {
        GeoServer.workspaces.get().then(
        function(result) {
          if (result.success) {
            $scope.workspaces = result.data;
            if (alreadyOpen_ws !== null) {
              $scope.closeOthers(alreadyOpen_ws);
            }
            $rootScope.$broadcast(AppEvent.WorkspacesFetched,
              $scope.workspaces);
          } else {
            // special case, check for 401 Unauthorized, if so be quiet
            if (result.status != 401) {
              $scope.alerts = [{
                type: 'warning',
                message: 'Could not get workspaces.',
                fadeout: true
              }];
            }
          }
        });
      }
    };

    $scope.onResize = function() {
      $rootScope.$broadcast(AppEvent.SidenavResized);
    };

    // re-open when sidebar toggled
    $scope.openWorkspace = function () {
      // find the open workspace and re-open
      var ws = $scope.workspaces;
      var open_ws, ws_inview, ws_notinview;

      if ($scope.toggleSide) {
        ws_inview = $scope.toggleWkspc2;
        ws_notinview = $scope.toggleWkspc;
      } else {
        ws_inview = $scope.toggleWkspc;
        ws_notinview = $scope.toggleWkspc2;
      }

      for (var t=0; t < ws.length; t++) {
        if (ws_inview[ws[t].name]) {
          open_ws = ws[t].name;
        }
        ws_notinview[ws[t].name] = false;
      }
      ws_notinview[open_ws] = true;
    };

    $scope.closeAll = function () {
      var ws = $scope.workspaces;
      for (var t=0; t < ws.length; t++) {
        $scope.toggleWkspc[ws[t].name] = false;
      }
    };

    $scope.closeOthers = function(workspacename) {
      $scope.closeAll();
      if (workspacename) {
        $scope.toggleWkspc[workspacename] = true;
      }
    };

    $scope.onWorkspaceClick = function(workspace) {
      if (! $scope.toggleWkspc[workspace.name]) { // open it
        $scope.closeOthers(workspace.name);
        var params = {workspace: workspace.name};
        var state = 'workspace';
        $state.go(state, params);
      } else {
        $scope.toggleWkspc[workspace.name] =
          ! $scope.toggleWkspc[workspace.name]; // close it
      }
    };

    $scope.onWorkspaceTabClick = function(workspace, detail) {
      var params = {workspace: workspace.name};
      var state = 'workspace';
      if (detail) {
        state += '.' + detail;
      }
      $state.go(state, params);
    };

    // When collapsed
    $scope.onWorkspaceClick2 = function(workspace, detail) {
      if (! $scope.toggleWkspc2[workspace.name]) { // open it
        $scope.closeOthers2(workspace.name);
        var params = {workspace: workspace.name};
        var state = 'workspace';
        if (detail) {
          state += '.' + detail;
        }
        $state.go(state, params);
      } else {
        $scope.toggleWkspc2[workspace.name] =
          ! $scope.toggleWkspc2[workspace.name]; // close it
      }
    };

    $scope.closeOthers2 = function(workspacename) {
      var workspaces = $scope.workspaces;
      for (var t=0; t < workspaces.length; t++) {
        $scope.toggleWkspc2[workspaces[t].name] = false;
      }
      if (workspacename) {
        $scope.toggleWkspc2[workspacename] = true;
      }
    };

    $scope.newWorkspace = function() {
      $state.go('workspaces.new');
    };

    $rootScope.$on(AppEvent.WorkspacesFetched,
      function(scope, workspaces) {
        $scope.workspaces = workspaces;
      });

    $rootScope.$on(AppEvent.WorkspaceNameChanged,
      function(scope, names) {
        $scope.workspaces.forEach(function(workspace) {
          if (workspace.name ===  names.original) {
            workspace.name = names.new;
            return;
          }
        });
      });

    $rootScope.$on(AppEvent.WorkspaceDeleted,
      function(scope, deletedSpaceName) {
        for (var p=0; p < $scope.workspaces.length; p++) {
          if ($scope.workspaces[p].name === deletedSpaceName) {
            $scope.workspaces.splice(p,1);
          }
        }
      });

    $rootScope.$on(AppEvent.ToggleSidenav,
      function(scope) {
        if (!$scope.toggleSide) {
          $scope.toggleSide = true;
          $timeout(function() {
            $scope.onResize();
          },450);
        }
      });

    $rootScope.$on(AppEvent.ServerError,
      function(scope, error) {
        $scope.alerts.push({
          type: 'danger',
          message: 'Server not responding ' + error.status + ': ' +
           error.data,
          fadeout: true
        });
      });
  }]);
