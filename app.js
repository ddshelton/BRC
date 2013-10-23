var express = require("./node_modules/express"),
  routes = require("./routes"),
  logo = require('./lib/logo'),
  color = require('colors'),
  ONEYEAR = 31557600000;
  
// Globals
path = require("path");
config = require("./settings/config");
fs = require("fs");
http = require("http");
https = require("https");
mime = require("./node_modules/mime");
sys = require("sys");
url = require("url");
pwd = path.dirname(require.main.filename);
app = express();
env = app.settings.env;
isReadyMongoDb = true;

// -- Import configuration
config = require('./settings/config'),
settings = config.settings;
config(app, express, env);

// -- Bootstrap Config
require('./bootstrap').boot(app);

// -- Routes
require('./routes/index')(app);

// -- Only listen on $ node app.js
logo.print();

// all environments
var PORTHTTPS = 8000;
app.set("port", process.env.PORT || 3000);
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.use(express.favicon());
app.use(express.logger("dev"));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(function (err, req, res, next) {
  if (!err) {
    return next();
  }
  res.json(400, {status: 400, error: "error in " + req.url});
  console.log(400, {status: 400, error: "error in " + req.url});
});

app.use(express.compress());
app.use(express.static(path.join(__dirname, "public"), {maxAge: ONEYEAR}));

app.use(function (req, res, next) {
  // the status option, or res.statusCode = 404
  // are equivalent, however with the option we
  // get the "status" local available as well
  //res.render("400", { status: 400, url: req.url });
  console.log("error 404 found", {status: 404, url: req.url});
  //res.json("error 404 ", {status: 404, url: req.url, text: "error 404 found"});
});

// development only
if ("development" === app.get("env")) {
  app.use(express.errorHandler());
}

//mongodb setup
db = null;
mongoDB = "cache";
mongoCollect = "imageCache";
try {
  MongoClient = require("mongodb").MongoClient;
  Server = require("mongodb").Server;
  mongoClient = new MongoClient(new Server("localhost", 27017));
  mongoClient.open(function (err, mongoClient) {
    try {
      db = mongoClient.db(mongoDB);
      db.collection(mongoCollect, {strict: true}, function (err, collection) {
        if (err) {
          console.log("The " + mongoDB + " database doesn't exist yet. It will be created upon need.");
        }
      });
      if (db && (db !== undefined)) {
        var sdb = require("./utils/processImage");
        sdb.cleanUpCacheMajor();
      }
    } catch (z) {
      isReadyMongoDb = false;
      console.log("mongo db not available: " + z);
    }
  });
} catch (e) {
  isReadyMongoDb = false;
  console.log("mongo db not available: " + e);
}

http.createServer(app).listen(settings.port, function(){
    console.log("Express server listening on "+" port %d ".bold.inverse.red+" in " + " %s mode ".bold.inverse.green + " //", settings.port, env);
    console.log('Using Express version %s...', express.version);
});

/*
 //for https server
 var options = {
 key: fs.readFileSync("test/fixtures/keys/agent2-key.pem"),
 cert: fs.readFileSync("test/fixtures/keys/agent2-cert.pem")
 };
 https.createServer(options, app).listen(PORTHTTPS);
 */

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err.stack);
  // TODO: let user know.
});
