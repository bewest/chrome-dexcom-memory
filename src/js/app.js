
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
  var spinner = $('.workflow-spinner');
  function scanned (err, list) {
    if (!err) {
      instr.trigger('update', list);
    }
  }
  function poller ( ) {
    spinner.toggleClass('fa-spin');
    serial.scan(scanned);
  }
  // var interval = setInterval(poller, 1000);
  var interval = null;
  function control_interval (ev, state) {
    console.log('UPDATING POLL STATUS', arguments);
    if (!control.is(':checked')) {
      if (interval) {
        clearInterval(interval);
        spinner.toggleClass('fa-spin', false);
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
    .addClass('instru')
    ;
  var rows = instr.selectAll('.row.instru')
    .data(list.ports);
  ;
  rows.enter( ).append(function (data, i) {
    var dup = cloned.clone(true);
    dup.find('.device-status').removeClass('created pending done').addClass('created');
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
  var partStat = $('#partition_template>.db.status').clone(true).addClass('pages');
  this
    /*
    .readHardwareBoard(function (err, header) {
      row.append($("<section/>").addClass('hardwareboard hide').html(header));
    })
    .readFirmwareHeader(function (err, header) {
      row.append($("<section/>").addClass('firmwareheader hide').html(header));
      console.log('header', header);
    })
    */
    .getEGVPageRange(function (err, range) {
      console.log('RANGE', range);
      var part = partStat.clone(true).addClass('egv');
      part.find('.v.name').text('EGVData');
      part.find('.v.outfile').text('EGVData.csv');
      part.find('.v.range.start').text(range.start);
      part.find('.v.currentPage').text(range.start);
      part.find('.v.range.end').text(range.end);
      part.find('.status_symbols').removeClass('created pending done').addClass('created');
      row.find('.container.schedule').append(part);



      part.data('streamName', 'EGV');
      part.data('range', range);
      part.data('columns', ['glucose', 'trend_arrow', 'noise']);
      part.trigger('device.scheduled', range, 'EGV');
      // scheduled

    })
    .getSensorPageRange(function (err, range) {
      var part = partStat.clone(true).addClass('sensor');
      part.find('.v.name').text('SensorData');
      part.find('.v.outfile').text('SensorData.csv');
      part.find('.v.range.start').text(range.start);
      part.find('.v.currentPage').text(range.start);
      part.find('.v.range.end').text(range.end);
      part.find('.status_symbols').removeClass('created pending done').addClass('created');
      row.find('.container.schedule').append(part);



      part.data('streamName', 'Sensor');
      part.data('range', range);
      part.data('columns', ['unfiltered', 'filtered', 'rssi']);
      part.trigger('device.scheduled', range, 'Sensor');
    })
    .loop(function do_scheduled_parts (end) {
      var active = row.find('.db.pages .status_symbols.created:first');
      if (active.is('.created')) {
        var part = active.closest('.db.pages');
        part.find('.status_symbols').removeClass('created pending done').addClass('pending');
        var streamName = part.data('streamName');
        var streamer = dexcom.streamify[streamName];
        var range = part.data('range');
        var info = {
          name: part.find('.v.outfile').text( )
        , notes: ['pages', range.end, 'through', range.stop, 'for', streamName ].join(" ")
        , columns: part.data('columns')
        };
        streamer(this, range.start, range.end)
          .on('progress', function onProgress (prog) {
            // part.trigger('progress', prog);
            part.find('.v.currentPage').text(prog.current);
            part.find('.progress .bar').css('width', (prog.progress * 100).toString( ) + '%');
          })
          .pipe(csv_stream({columns: info.columns}))
          .pipe(es.writeArray(function (err, csvs) {
            zip.addFile(info.name, new Buffer(csvs.join('\n')), info.notes || info.name);
            part.find('.status_symbols').removeClass('created pending done').addClass('done');
            part.trigger('page.finished');
          }));

      } else {
        end( );
      }


    })
    /*
    */
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
      var name = row.find('.zipfile').text( ) || "dexcom_download.zip";
      console.log("CLOSING", name);
      var blob = new Blob([zip.toBuffer( )]);
      saveAs(blob, name);
      row.find('.device-status').removeClass('created pending done').addClass('done');
    })
    ;
}

function csv_stream (opts) {
  if (!opts) opts = { };
  var head_fields = opts.head || [ 'system', 'display' ];
  var body_fields = opts.columns;

  function iter (data, next) {
    var fields = [ ];
    head_fields.forEach(function (el) {
      fields.push(data[el].toISOString( ));
    });
    body_fields.forEach(function (el) {
      fields.push(data[el]);
    });
    next(null, fields.join(','));
  }

  return es.map(iter);

}

function identify_device (ev, data, i) {
  console.log("identify_device", data, arguments, ev.target);
  var target = $(ev.target);
  target.find('.device-status').removeClass('created pending done').addClass('pending');
  var conn = serial.acquire(data, function opened (device) {
    console.log("HAHAHA opened DEV", device);
    var tx = dexcom(conn);
    tx.dom = ev.target;
    tx.api
      .ping(console.log.bind(console, 'PING'))
      .readFirmwareSettings(console.log.bind(console, 'readFirmwareSettings'))
      .readManufacturingData(0, function (err, resp) {
        tx.manufacturer = err || resp.json.pop( );
        target.trigger('device.inspecting', tx);
      })
      .tap(function ( ) {
        inspect.call(this, tx);
    })
    .tap(function finisher ( ) {
    })
    .close( );
    ;
  });
  console.log('SERIAL', ser);
}

function stitch_manufacturer (ev, tx) {
  var target = $(ev.target);
  var xml = tx.manufacturer.xml;
  var info = $('<section />').addClass('manufacturer hide').html(xml);
  target.find('.xmlinfo')
    .append(info);
  info = info.find('manufacturingparameters');
  var serial = info.attr('serialnumber');
  target.find('.serial').text(serial);
}

function init ( ) {
  console.log('initing app');
  $('#download_1').on('click', do_download);
  $('#download_2').on('click', do_zip_download);
  var instr = $('.instruments');
  instr.on('update', do_updates);
  $(".v.switchcheck").bootstrapSwitch( );
  $('.instruments').on('detected', identify_device);
  $('.instruments').on('device.inspecting', stitch_manufacturer);
  poll($('#auto_poll'));
}
$(window).ready(init);

module.exports = init;
