
var $ = require('jquery');

console.log('app.js');

function onEntry (handle) {
  console.log('got handle', handle);
  var txt = $('#tmp').text( );
  console.log('text', txt);
  var history = $('#history');
  var cloned = history.find('.template.skeleton')
    .clone(true).removeClass('skeleton')
  ;
  chrome.fileSystem.getDisplayPath(handle, function (path) {
    cloned.find('.v.path').text(path);
  });
  history.append(cloned);

  handle.createWriter(function (fileWriter) {
    var blob = new Blob([txt]);
    console.log('perform IO', blob, fileWriter);
    var finished = false;
    function finish (size) {
      finished = true;
      console.log('inner this', this, size);
      this.truncate(blob.size);
    }

    fileWriter.onwriteend = function (e) {
      if (!finished) {
        cloned.css({color:'yellow'});
        return finish.call(this, blob.size);
      }
      cloned.css({color:'green'});
    };

    fileWriter.onerror = function (e) {
      cloned.css({color:'red'});
      console.error(e);
    } ;

    fileWriter.write(blob);
  });
}

function do_download ( ) {
  var chooser = {
    type: 'saveFile',
    suggestedName: 'my_file_exported.txt',
    accepts: [ { description: 'Text files (*.txt)',
                 extensions: [ 'txt' ] } ],
    acceptsAllTypes: true
  };
  chrome.fileSystem.chooseEntry(chooser, onEntry);
}

function init ( ) {
  console.log('initing app');
  $('#download').on('click', do_download);
}
$(window).ready(init);

module.exports = init;
