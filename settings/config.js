
// -- Global settings
var settings = {
    'siteName' : 'BRC',
    'sessionSecret' : 'sessionSecret',
    'uri' : 'http://localhost', // Without trailing /
    'port' : process.env.PORT || 3000,
    'debug' : 0,
    'profile' : 0
};

/**
 * Default configuration manager
 * Inject app and express reference
 */

module.exports = function(app, express, env) {

    // -- DEVELOPMENT
    if ('development' == env) {
        require("./development")(app, express);
    }

    // -- PRODUCTION
    if ('production' == env) {
        require("./production")(app, express);
    }

};

module.exports.settings = settings;


//from Wess-Widget for reference
/*
var config = {};

config.cache = {};
config.ddf = {};
config.openam = {};
config.vantage = {};
config.web = {};
config.install = {};

config.siteId = "SDLH"; // This is the name of the site e.g. Site 6, Site 10, ECH, WCH.

config.cache.SizeAllowable = 2000000000;
config.cache.DaysLimit = 90;
config.cache.IdleTime = 60000; // 1 minute (1000 * 60 *1)

config.ddf.host = "localhost";
config.ddf.port = 8181;
config.ddf.path = "/services/catalog/query";

config.openam.enabled = false;
config.openam.baseUrl = "http://localhost:8080/openam_10.0.0/";
config.openam.callbackUrl = "http://localhost:3000/auth/openam/callback";

config.vantage.host = "localhost";
config.vantage.port = 20960;

config.web.port = process.env.WEB_PORT || 3000;

config.install.writeableFolder = "C:\\Vantage Web";

module.exports = config;

*/