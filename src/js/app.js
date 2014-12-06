
var $ = require('jquery');

console.log('app.js');

function init ( ) {
  console.log('initing app');
}
$(window).ready(init);

module.exports = init;
