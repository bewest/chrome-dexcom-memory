
var $ = window.jQuery = window.$ = require('jquery');
var bswitch = require('bootstrap-switch');
// var bswitch = require('../../bower_components/bootstrap-switch/dist/js/bootstrap-switch.min.js');
var d3 = require('d3');
var Buffer = require('buffer').Buffer;
var Zip = require('adm-zip');
var saveAs = require('browser-filesaver');
var es = require('event-stream');
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

function inspect (device) {

  var row = $(device.dom);
  var zip = new Zip;
  var name = "dexcom_download.zip";
  this
    .readHardwareBoard(function (err, header) {
      row.append($("<section/>").addClass('hardwareboard').html(header));
    })
    .readFirmwareHeader(function (err, header) {
      row.append($("<section/>").addClass('firmwareheader').html(header));
      console.log('header', header);
    })
    .getEGVPageRange(function (err, range) {
      console.log('RANGE', range);
      row.append(
        $('<section/>')
          .addClass('range')
          .append(
            $('<tt/>')
              .addClass('start')
              .text(range.start)
          )
          .append(
            $('<tt/>')
              .addClass('end')
              .text(range.end)
          )
      ) ;
      device.createRangedEGVStream(this, range.start, range.end)
        .pipe(es.map(function (data, next) {
          var fields = [ ];
          ['system', 'display'].forEach(function (el) {
            fields.push(data[el].toISOString( ));
          });
          ['glucose', 'trend_arrow', 'noise'].forEach(function (el) {
            fields.push(data[el]);
          });
          next(null, fields.join(','));
        }))
        .pipe(es.writeArray(function (err, csvs) {
          zip.addFile("egvdata.csv", new Buffer(csvs.join('\n')), 'egvdata');
        }));;

    })
    .ReadDatabasePartitions(function (err, partitions) {
      console.log(partitions);
      row.append(
        $('<section/>')
          .addClass('partitions')
          .html(partitions)
      ) ;
      $('#tmp').text(partitions);
    })
    .tap(function finish ( ) {
      console.log("CLOSING");
      var blob = new Blob([zip.toBuffer( )]);
      saveAs(blob, name);
    })
    .close( );
    ;
}

function identify_device (ev, data, i) {
  console.log("identify_device", data, arguments, ev.target);
  var conn = serial.acquire(data, function opened (device) {
    console.log("HAHAHA opened DEV", device);
    var tx = dexcom(conn);
    tx.dom = ev.target;
    tx.api
      .ping(console.log.bind(console, 'PING'))
      .readFirmwareSettings(console.log.bind(console, 'readFirmwareSettings'))
      .tap(function ( ) {
        inspect.call(this, tx);
    });
  });
  console.log('SERIAL', ser);
}

function init ( ) {
  console.log('initing app');
  $('#download_1').on('click', do_download);
  $('#download_2').on('click', do_zip_download);
  var instr = $('.instruments');
  instr.on('update', do_updates);
  $(".v.switchcheck").bootstrapSwitch( );
  $('.instruments').on('detected', identify_device);
  poll($('#auto_poll'));
}
$(window).ready(init);

module.exports = init;
