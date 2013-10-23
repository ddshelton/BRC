//for starting app.js under a windows service
process.chdir(__dirname);
var fs = require("fs");
var service = require("./node_modules/windows-service");
var serviceName = "VANTAGE Web Service";
var logStream = fs.createWriteStream(require("path").join(require("./settings/config").install.writeableFolder, "VANTAGE_Web_Service.log"));

if (process.argv[2] === "--install") {
  service.add(serviceName, {programArgs: ["--run"]});
} else if (process.argv[2] === "--uninstall") {
  service.remove(serviceName);
} else if (process.argv[2] === "--run") {
  service.run(logStream, function () {
    service.stop(0);
  });
  var forever = require("./node_modules/forever-monitor");
  var child = new (forever.Monitor)("app.js", {
    minUptime: 1000,
    silent: false,
    spinSleepTime: 10000
  });

  child.on("exit", function () {
    console.log(serviceName + " is no longer running.");
  });

  child.start();
} else {
  console.log("USAGE:\n\tservice [--run] [--install] [--uninstall]");
}

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err + "\n" + err.stack);
});
