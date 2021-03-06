/*
 * (c) 2014 Boundless, http://boundlessgeo.com
 */
angular.module('gsApp.workspaces.layers.settings', [])
.controller('EditLayerSettingsCtrl', ['workspace', 'layer', '$scope',
  '$rootScope', '$state', '$log', '$modalInstance', 'GeoServer', 'AppEvent',
  'layersListModel', '$sce',
    function(workspace, layer, $scope, $rootScope, $state, $log,
      $modalInstance, GeoServer, AppEvent, layersListModel, $sce) {

      $scope.workspace = workspace;
      $scope.layer = angular.copy(layer);
      $scope.layername = {};
      $scope.layername = layer.name;

      $scope.form = {};
      $scope.form.mapSettings = {};
      var originalLayer = angular.copy($scope.layer);

      $scope.crsTooltip =
      '<h5>Add a projection in EPSG</h5>' +
      '<p>Coordinate Reference System (CRS) info is available at ' +
        '<a href="http://prj2epsg.org/search" target="_blank">' +
          'http://prj2epsg.org' +
        '</a>' +
      '</p>';

      $scope.getGeoServerLink = function() {
        var url = GeoServer.baseUrl() +'/web/?wicket:bookmarkablePage=:org.' +
          'geoserver.web.data.resource.ResourceConfigurationPage&name=' +
          layer.name + '&wsName=' + $scope.workspace;
        $scope.layer.link = url;
      };
      $scope.getGeoServerLink();

      $scope.saveChanges = function() {
        // clear any error state
        $scope.errorSaving = '';
        $scope.form.layerSettings.alerts = null;

        if ($scope.form.layerSettings.$dirty) {
          var patch = {};
          if (originalLayer.name !== $scope.layer.name) {
            patch.name = $scope.layer.name;
          }
          if (originalLayer.title !== $scope.layer.title) {
            patch.title = $scope.layer.title;
          }
          if (originalLayer.proj.srs !== $scope.layer.proj.srs) {
            patch.proj = $scope.layer.proj.srs;
          }
          if (originalLayer.description !== $scope.layer.description) {
            patch.description = $scope.layer.description;
          }

          GeoServer.layer.update($scope.workspace, originalLayer.name, patch)
          .then(function(result) {
              if (result.success) {
                $scope.form.layerSettings.saved = true;
                $scope.form.layerSettings.$setPristine();
                $rootScope.$broadcast(AppEvent.LayerUpdated, {
                  'original': originalLayer,
                  'new': $scope.layer
                });
                originalLayer = angular.copy($scope.layer);
                $modalInstance.close($scope.layer);
              } else {
                $scope.form.layerSettings.saved = false;
                $scope.form.layerSettings.alerts = 'Layer update failed: ' +
                 result.data.message;
                $scope.errorSaving = 'Update failed.';
                $rootScope.alerts = [{
                  type: 'warning',
                  message: 'Layer update failed: ' + result.data.message,
                  details: result.data.trace,
                  fadeout: true
                }];
              }
            });
        }
      };

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };
    }]);
