/*
 * (c) 2014 Boundless, http://boundlessgeo.com
 */
/*global CodeMirror */
angular.module('gsApp.styleditor', [
  'ui.codemirror',
  'gsApp.styleditor.ysldhinter',
  'gsApp.styleditor.save',
  'gsApp.styleditor.undo',
  'gsApp.styleditor.layers',
  'gsApp.styleditor.color',
  'gsApp.styleditor.icons',
  'gsApp.styleditor.attributes',
  'gsApp.styleditor.display',
  'gsApp.styleditor.sld',
  'gsApp.styleditor.fullscreen'
])
.directive('styleEditor', ['$compile', '$sanitize', '$timeout', '$log',
    'YsldHinter', '$rootScope', '$sce', '$document',
    function($compile, $sanitize, $timeout, $log, YsldHinter,
      $rootScope, $sce, $document) {
      return {
        restrict: 'EA',
        scope: {
          layer: '=?',
          ysldstyle: '=',
          markers: '=?',
          editor: '=?'
        },
        templateUrl: '/components/styleditor/styleditor.tpl.html',
        controller: function($scope, $element) {
          $scope.onCodeMirrorLoad = function(editor) {
            $rootScope.editor = editor;

            editor.on('change', function(cm, change) {
              if (change.origin == 'setValue') {
                $timeout(function() {
                  cm.clearHistory();
                }, 0);
                $rootScope.generation = cm.changeGeneration();
              }
            });
            //Use custom events for all Cmd/Ctrl key events to override default functionality and enable OS X compatibility
            editor.on('keydown', function(cm, change) {
              if (navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? change.metaKey : change.ctrlKey) {
                //Hint: Ctrl/Cmd Enter
                if (change.keyCode == 13) {
                  change.preventDefault();
                  cm.showHint({
                    hint: function(cm, options) {
                      return YsldHinter.hints(cm, angular.extend(options, {
                        layer: $scope.layer
                      }));
                    }
                  });

                //Fold: Ctrl/Cmd <
                } else if (change.keyCode == 188) {
                  change.preventDefault();
                  var pos = {line: cm.getCursor().line, ch:cm.getLine(cm.getCursor().line).length};
                  //get end of first unfolded line
                  while(pos.line > 0 && cm.isFolded(pos)) {
                    pos = {line: pos.line-1, ch:cm.getLine(pos.line-1).length};
                  }
                  cm.foldCode(pos, {
                    rangeFinder: CodeMirror.fold.indent,
                    scanUp: true
                  }, "fold");

                //Unfold: Ctrl/Cmd >
                } else if (change.keyCode == 190) {
                  change.preventDefault();
                  var pos = {line: cm.getCursor().line, ch:0};
                  //get beginning of first unfolded line
                  while(pos.line > 0 && cm.isFolded(pos)) {
                    pos = {line: pos.line-1, ch:0};
                  }
                  
                  cm.foldCode(pos, {
                    rangeFinder: CodeMirror.fold.indent,
                    scanUp: true
                  }, "unfold");
                //Comment: 3/#
                } else if (change.keyCode == 51) {
                  change.preventDefault();

                  var cur = cm.getCursor();
                  var line = cm.getLine(cur.line);

                  //Comment lines; otherwise uncomment lines
                  if (line.search(/^\s*#/) == -1) {
                    var comment = true;
                  }

                  var ranges = cm.listSelections();
                  for (var i = 0; i < ranges.length; i++) {
                    var range = ranges[i];
                    var start = range.head.line > range.anchor.line ? range.anchor.line : range.head.line;
                    var end = range.head.line > range.anchor.line ? range.head.line : range.anchor.line;
                    for (var j = start; j <= end; j++) {
                      line = cm.getLine(j);
                      var length = line.length;
                      line = line.replace(/^(\s*)(#)/, "$1");
                      if (comment) {
                        line = "#" + line;
                      }
                      cm.replaceRange(line, {ch:0, line:j}, {ch:length, line:j});

                    }
                  }
                }
              }
            });
          };

          $scope.codeMirrorOpts = {
            lineWrapping : true,
            lineNumbers: true,
            styleActiveLine: true,
            mode: 'yaml',
            paletteHints: true,
            foldGutter: true,
            gutters: ['markers', 'CodeMirror-foldgutter'],
            extraKeys: {
              // tab remapping taken from:
              //   https://gist.github.com/danieleds/326903084a196055a7c3
              'Tab': function (cm) {
                if (cm.somethingSelected()) {
                  var sel = cm.getSelection('\n');
                  var cur = cm.getCursor();

                  // Indent only if there are multiple lines selected,
                  // or if the selection spans a full line
                  if (sel.length > 0 && (sel.indexOf('\n') > -1 ||
                    sel.length === cm.getLine(cur.line).length)) {
                    cm.indentSelection('add');
                    return;
                  }
                }

                if (cm.options.indentWithTabs) {
                  cm.execCommand('insertTab');
                }
                else {
                  cm.execCommand('insertSoftTab');
                }
              },
              'Shift-Tab': function (cm) {
                cm.indentSelection('subtract');
              }
              // 'Tab': function(cm) {
              //   // replace tabs with spaces
              //   var spaces =
              //     new Array(cm.getOption('indentUnit') + 1).join(' ');
              //   cm.replaceSelection(spaces);
              // }
            },
            tabMode: 'spaces'
          };

          $scope.setPopup = function(){
            //Wait a little bit before setting the popover element. We need to
            //ensure that it exists so we can remove it later on if necessary.
            //If we don't explicitly remove it then the popover will remain on
            //the new code mirror window.
            $timeout(function() {
              $rootScope.popoverElement = angular.element(
                $document[0].querySelectorAll('.popover'));
              //Put the popovers below any modals:
              for (var i = 0; i < $rootScope.popoverElement.length; i++) {
                $rootScope.popoverElement[i].style['z-index'] = 1040;
              }
            }, 250);
          };

          $scope.$watch('markers', function(newVal) {
            $scope.editor.clearGutter('markers');
            if (newVal != null) {
              newVal.forEach(function(mark) {

                var html = '<a class="icon-warning" ' +
                  'popover="' +
                  $sce.trustAsHtml($sanitize(mark.problem)) +
                  '" ' + 'popover-placement="left" ' +
                  'popover-append-to-body="true"' +
                  'title="Click to toggle the error message on/off." ' +
                  'alt="Click to toggle the error message on/off."' +
                  'ng-click="setPopup()"></a>';

                var marker = $compile(html)($scope)[0];
                $scope.editor.setGutterMarker(mark.line, 'markers', marker);
              });
            }
          });
        }
      };
    }])
.run(['$log',
    function($log) {
      CodeMirror.prototype.insertOrReplace = function(value) {
        if (this.somethingSelected()) {
          // replace the selection
          this.replaceSelection(value, 'around');
        }
        else {
          // insert
          this.replaceRange(value, this.getCursor());
        }
      };
    }]);
