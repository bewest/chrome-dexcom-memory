

console.log('from background');

chrome.app.runtime.onLaunched.addListener(function ( ) {
  console.log('launching app');
  chrome.app.window.create('html/index.html', {
    'bounds': {
      'width': 500
    , 'height': 500
    }
  });
});


