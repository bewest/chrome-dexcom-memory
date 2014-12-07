
var $ = window.jQuery = window.$ = require('jquery');
var bswitch = require('bootstrap-switch');
// var bswitch = require('../../bower_components/bootstrap-switch/dist/js/bootstrap-switch.min.js');
var d3 = require('d3');
var Buffer = require('buffer').Buffer;
var Zip = require('adm-zip');
var saveAs = require('browser-filesaver');
var dexcom = require('dexcom-uart');
var serial = require('serial-chromeify');

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

function do_zip_download ( ) {
  var zip = new Zip;
  var name = "dexcom_download.zip";
  var txt = $('#tmp').text( );
  zip.addFile("manifest.txt", new Buffer(txt), 'manifest');
  var blob = new Blob([zip.toBuffer( )]);
  saveAs(blob, name);
  var history = $('#history');
  var cloned = history.find('.template.skeleton')
    .clone(true).removeClass('skeleton')
  ;
  cloned.find('.v.path').text(name);
  history.append(cloned);
}

function poll (control) {
  var instr = $('.instruments');
  function scanned (err, list) {
    console.log('scanned serial', err, list);
    if (!err) {
      instr.trigger('update', list);
    }
  }
  function poller ( ) {
    serial.scan(scanned);
  }
  // var interval = setInterval(poller, 1000);
  var interval = null;
  function control_interval (ev, state) {
    console.log('UPDATING POLL STATUS', arguments);
    if (!control.is(':checked')) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    } else {
      if (!interval) {
        interval = setInterval(poller, 1000);
      }

    }
  }
  control.on('change init switchChange.bootstrapSwitch', control_interval);
  control.trigger('init');
}

function do_updates (ev, list) {
  console.log("DRAW UPDATED", list);
  var instr = d3.select('.instruments');
  var cloned = $(instr.select('.skeleton.template')[0])
    .clone(true)
    .removeClass('skeleton')
    .addClass('row')
    ;
  var rows = instr.selectAll('.row')
    .data(list.ports);
  ;
  rows.enter( ).append(function (data, i) {
    var dup = cloned.clone(true);
    dup.find('.device').text(data);
    // d3.select(this).append(d3.select(dup.get( )));
    console.log('each', data, i, this, dup.get( )[0]);
    return dup.get( )[0];
  }).each(function iter (data, i) {
    console.log('tapped?', this, data);
    $(this).trigger('detected', data, i);
  });
  rows.exit( ).remove( );
}

function init ( ) {
  console.log('initing app');
  $('#download_1').on('click', do_download);
  $('#download_2').on('click', do_zip_download);
  var instr = $('.instruments');
  instr.on('update', do_updates);
  $(".v.switchcheck").bootstrapSwitch( );
  poll($('#auto_poll'));
}
$(window).ready(init);

module.exports = init;
