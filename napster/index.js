'use strict';

const libQ = require('kew');
const fs = require('fs-extra');


module.exports = napster;

function napster(context) {
    const self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}


napster.prototype.onVolumioStart = function () {
    const self = this;
    const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

napster.prototype.onStart = function () {
    const self = this;
    const defer = libQ.defer();

    // Once the Plugin has successfully started resolve the promise
    defer.resolve();

    return defer.promise;
};

napster.prototype.onStop = function () {
    const self = this;
    const defer = libQ.defer();

    // Once the Plugin has successfully stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

napster.prototype.onRestart = function () {
    const self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

napster.prototype.getUIConfig = function () {
    const defer = libQ.defer();
    const self = this;

    const lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {
            uiconf.sections[0].content[0].value.value = self.config.get('email');
            uiconf.sections[0].content[1].value.value = self.config.get('password');

            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });
    return defer.promise;
};

napster.prototype.configSaveAccountSettings = function (data) {
    const self = this;
    const defer = libQ.defer();

    self.config.set('email', data['email']);
    self.config.set('password', data['password']);

    self.commandRouter.pushToastMessage('success', "Saved", 'Your Napster account settings have been successfully updated');

    defer.resolve();

    return defer.promise;
};

napster.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

napster.prototype.setUIConfig = function (data) {
    const self = this;
    //Perform your installation tasks here
};

napster.prototype.getConf = function (varName) {
    const self = this;
    //Perform your installation tasks here
};

napster.prototype.setConf = function (varName, varValue) {
    const self = this;
    //Perform your installation tasks here
};


// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


napster.prototype.addToBrowseSources = function () {

    // Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

napster.prototype.handleBrowseUri = function (curUri) {
    const self = this;

    //self.commandRouter.logger.info(curUri);
    let response;


    return response;
};


// Define a method to clear, add, and play an array of tracks
napster.prototype.clearAddPlayTrack = function (track) {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    return self.sendSpopCommand('uplay', [track.uri]);
};

napster.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::seek to ' + timepos);

    return this.sendSpopCommand('seek ' + timepos, []);
};

// Stop
napster.prototype.stop = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::stop');


};

// Spop pause
napster.prototype.pause = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::pause');


};

// Get state
napster.prototype.getState = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::getState');


};

//Parse state
napster.prototype.parseState = function (sState) {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::parseState');

    //Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
napster.prototype.pushState = function (state) {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::pushState');

    return self.commandRouter.servicePushState(state, self.servicename);
};


napster.prototype.explodeUri = function (uri) {
    const self = this;
    const defer = libQ.defer();

    // Mandatory: retrieve all info for a given URI

    return defer.promise;
};

napster.prototype.getAlbumArt = function (data, path) {

    let artist, album;

    if (data != undefined && data.path != undefined) {
        path = data.path;
    }

    let web;

    if (data != undefined && data.artist != undefined) {
        artist = data.artist;
        if (data.album != undefined)
            album = data.album;
        else album = data.artist;

        web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
    }

    let url = '/albumart';

    if (web != undefined)
        url = url + web;

    if (web != undefined && path != undefined)
        url = url + '&';
    else if (path != undefined)
        url = url + '?';

    if (path != undefined)
        url = url + 'path=' + nodetools.urlEncode(path);

    return url;
};


napster.prototype.search = function (query) {
    const self = this;
    const defer = libQ.defer();

    // Mandatory, search. You can divide the search in sections using following functions

    return defer.promise;
};

napster.prototype._searchArtists = function (results) {

};

napster.prototype._searchAlbums = function (results) {

};

napster.prototype._searchPlaylists = function (results) {


};

napster.prototype._searchTracks = function (results) {

};

napster.prototype.goto = function (data) {
    const self = this;
    const defer = libQ.defer();

// Handle go to artist and go to album function

    return defer.promise;
};
