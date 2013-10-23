var forever = require('forever-monitor');

var child = new (forever.Monitor)('app.js', {
  silent: true,
  sourceDir: './'
});

child.on('exit', function () {
  console.log("exiting forever monitor");
});

child.start();

