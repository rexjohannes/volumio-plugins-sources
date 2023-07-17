'use strict';

const libQ = require('kew');
const axios = require('axios');
const url = require('url');

const apiUrl = 'https://api.napster.com';
const apiKey = "ZTJlOWNhZGUtNzlmZS00ZGU2LTkwYjMtZDk1ODRlMDkwODM5"
const userAgent = 'android/8.1.9.1055/NapsterGlobal';

module.exports = napster;

function napster(context) {
    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}


napster.prototype.onVolumioStart = function () {
    const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

napster.prototype.onStart = function () {
    const self = this;
    const defer = libQ.defer();

    self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
    self.addToBrowseSources();

    // Once the Plugin has successfully started resolve the promise
    defer.resolve();

    return defer.promise;
};

napster.prototype.onStop = function () {
    const defer = libQ.defer();
    this.commandRouter.volumioRemoveToBrowseSources('Napster');

    // Once the Plugin has successfully stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

napster.prototype.onRestart = function () {
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
            uiconf.sections[0].content[0].value = self.config.get('email');
            // TODO: Hide password
            uiconf.sections[0].content[1].value = self.config.get('password');

            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });
    return defer.promise;
};

napster.prototype.saveNapsterAccount = async function (data) {
    const self = this;
    const defer = libQ.defer();

    self.config.set('email', data['email']);
    self.config.set('password', data['password']);

    await self.login(data['email'], data['password']);
    defer.resolve();

    return defer.promise;
};

napster.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

napster.prototype.setUIConfig = function (data) {
    //Perform your installation tasks here
};

napster.prototype.getConf = function (varName) {
    //Perform your installation tasks here
};

napster.prototype.setConf = function (varName, varValue) {
    //Perform your installation tasks here
};

napster.prototype.login = async function (email, password) {
    const self = this;
    const params = new url.URLSearchParams({
        'username': email,
        'password': password,
        'grant_type': 'password'
    })
    await axios.post(apiUrl + '/oauth/token', params.toString(), {
        headers: {
            'Authorization': 'Basic WlRKbE9XTmhaR1V0TnpsbVpTMDBaR1UyTFRrd1lqTXRaRGsxT0RSbE1Ea3dPRE01Ok1UUmpaVFZqTTJFdE9HVmxaaTAwT1RVM0xXRm1Oamt0TlRsbE9ERmhObVl5TnpJNQ==',
            'User-Agent': userAgent,
            'X-Px-Authorization': '3',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }).then(function (response) {
        let resp = response.data;
        self.config.set('access_token', resp['access_token']);
        self.config.set('refresh_token', resp['refresh_token']);
        self.config.set('expires_at', Date.now() + resp['expires_in'] * 1000);
        self.config.set('catalog', resp['catalog']);
        self.commandRouter.pushToastMessage('success', "Logged in", 'Successfully logged in to Napster');
    }).catch(function () {
        self.commandRouter.pushToastMessage('error', "Error", 'Could not log in to Napster');
    })
}

napster.prototype.getStreamUrl = async function (trackId) {
    const self = this;
    let resp = await axios.get(apiUrl + '/v3/streams/tracks?bitDepth=16&bitrate=44100&format=FLAC&id=' + trackId + '&sampleRate=44100', {
        headers: {
            'Authorization': 'Bearer ' + self.config.get('access_token'),
            'User-Agent': userAgent,
            'X-Px-Authorization': '3'
        }
    });
    resp = resp.data;
    return resp['streams'][0]['primaryUrl'];
}

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


napster.prototype.addToBrowseSources = function () {

    // Use this function to add your music service plugin to music sources
    const data = {name: 'Napster', uri: 'napster', plugin_type: 'music_service', plugin_name: 'napster', "albumart": "/albumart?sourceicon=music_service/napster/images/napster.png"};
    this.commandRouter.volumioAddToBrowseSources(data);
};

napster.prototype.handleBrowseUri = function (curUri) {
    const self = this;
    let response;

    if (curUri.startsWith('napster')) {
        if (curUri === 'napster') {
            response = libQ.resolve({
                navigation: {
                    prev: {
                        uri: 'napster'
                    },
                    lists: [
                        {
                            "title": "My Music",
                            "icon": "fa fa-folder-open-o",
                            "availableListViews": ["list","grid"],
                            "items": [
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Playlists',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/playlists'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Favorites',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/favorites'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Tracks',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/tracks'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Albums',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/albums'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'My Top Plays',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/charts'
                                }
                            ]
                        },
                        {
                            "title": "Napster",
                            "icon": "fa fa-folder-open-o",
                            "availableListViews": ["list","grid"],
                            "items": [
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Moods & Genres',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/genres'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Tracks',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/popular/tracks'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Albums',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/popular/albums'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Artists',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/popular/artists'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'New Releases',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-folder-open-o',
                                    uri: 'napster/new_releases'
                                }
                            ]
                        }
                    ]
                }
            });
        }
        else if (curUri.startsWith('napster/playlists')) {
        }
    }

    return response;
};


// Define a method to clear, add, and play an array of tracks
napster.prototype.clearAddPlayTrack = function (track) {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::clearAddPlayTrack');

    const napsterListenerCallback = () => {
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster: MPD player state update');
        self.mpdPlugin.getState()
            .then(function (state) {
                var selectedTrackBlock = self.commandRouter.stateMachine.getTrack(self.commandRouter.stateMachine.currentPosition);
                if (selectedTrackBlock.service && selectedTrackBlock.service === 'napster') {
                    self.mpdPlugin.clientMpd.once('system-player', napsterListenerCallback);
                    return self.pushState(state);
                } else {
                    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster: Not a napster track, removing listener');
                }
            });
    };

    self.getStreamUrl(track.id).then(r => {
        return self.mpdPlugin.sendMpdCommand('stop', [])
            .then(function() {
                return self.mpdPlugin.sendMpdCommand('clear', []);
            })
            .then(function() {
                return self.mpdPlugin.sendMpdCommand('load "' + r + '"', []);
            })
            .fail(function() {
                return self.mpdPlugin.sendMpdCommand('add "' + r + '"', []);
            })
            .then(function() {
                self.mpdPlugin.clientMpd.removeAllListeners('system-player');
                self.mpdPlugin.clientMpd.once('system-player', napsterListenerCallback);

                return self.mpdPlugin.sendMpdCommand('play', [])
                    .then(function() {
                        return self.mpdPlugin.getState()
                            .then(function(state) {
                                return self.pushState(state);
                            });
                    });
            });
    });
};

napster.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::seek to ' + timepos);

    return this.mpdPlugin.seek(timepos);
};

// Stop
napster.prototype.stop = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::stop');

    return self.mpdPlugin.stop()
        .then(function() {
            return self.mpdPlugin.getState()
                .then(function(state) {
                    return self.pushState(state);
                });
        });
};

// Spop pause
napster.prototype.pause = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::pause');

    return self.mpdPlugin.stop()
        .then(function() {
            return self.mpdPlugin.getState()
                .then(function(state) {
                    return self.pushState(state);
                });
        });
};

napster.prototype.resume = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::resume');
    return self.mpdPlugin.resume()
        .then(function() {
            return self.mpdPlugin.getState()
                .then(function(state) {
                    return self.pushState(state);
                });
        });
}

napster.prototype.prefetch = function(nextTrack) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::prefetch');

    self.getStreamUrl(nextTrack.id).then(r => {
        return self.mpdPlugin.sendMpdCommand('add "' + r + '"', [])
            .then(function() {
                return self.mpdPlugin.sendMpdCommand('consume 1', []);
            });
    });
}

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

    return self.commandRouter.servicePushState(state, "napster");
};


napster.prototype.explodeUri = function (uri) {
    const self = this;
    const defer = libQ.defer();

    if (uri.startsWith('napster/track')) {
        axios.get('https://api.napster.com/v2.2/tracks/' + uri.split('/')[2], {
            headers: {
                "Apikey": apiKey,
                "User-Agent": userAgent,
                'X-Px-Authorization': '3'
            }
        }).then(function (response) {
            if (response.data.tracks.length > 0) defer.resolve(self.parseNapsterTrack(response.data.tracks[0]));
            else defer.reject(new Error('napster track not found'));
        });
    } else {
        defer.reject(new Error('napster uri unknown'));
    }

    return defer.promise;
};

napster.prototype.getAlbumArt = function (data, path) {

    let artist, album;

    if (data !== undefined && data.path !== undefined) {
        path = data.path;
    }

    let web;

    if (data !== undefined && data.artist !== undefined) {
        artist = data.artist;
        if (data.album !== undefined)
            album = data.album;
        else album = data.artist;

        web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
    }

    let url = '/albumart';

    if (web !== undefined)
        url = url + web;

    if (web !== undefined && path !== undefined)
        url = url + '&';
    else if (path !== undefined)
        url = url + '?';

    if (path !== undefined)
        url = url + 'path=' + nodetools.urlEncode(path);

    return url;
};

napster.prototype.getAlbumImg = function (id) {
    const self = this;
    return apiUrl + "/imageserver/v2/albums/" + id + "/images/" + self.config.get('albumImageSize') + ".jpg"
}


napster.prototype.search = function (query) {
    const self = this;
    const defer = libQ.defer();
    // &lang=en_US &rights=2
    axios.get(apiUrl + '/v2.2/search?catalog=' + self.config.get('catalog') + '&offset=0&per_type_limit=20&query=' + encodeURI(query.value.toLowerCase()) + '&type=album,artist,track,playlist', {
        headers: {
            "Apikey": apiKey,
            "User-Agent": userAgent,
            "X-Px-Authorization": "3"
        }
    }).then(function (resp) {
        let list = [];
        let trackList = [];
        for (let i in resp.data.search.data.tracks) {
            trackList.push(self.parseNapsterTrack(resp.data.search.data.tracks[i]));
        }
        list.push({title: "Napster Tracks", icon: "fa fa-music", availableListViews: ["list", "grid"], items: trackList});
        defer.resolve(list)
    }).catch(function (err) {
        self.commandRouter.logger.info(err);
    });
    return defer.promise;
};

napster.prototype.parseNapsterTrack = function (data) {
    const self = this;
    return {
        service: "napster",
        type: "song",
        title: data["name"],
        name: data["name"],
        artist: data["artistName"],
        album: data["albumName"],
        albumart: self.getAlbumImg(data["albumId"]),
        uri: 'napster/track/' + data["id"],
        id: data["id"]
    };
}

napster.prototype.getTrackInfo = function (uri) {
    const self = this;
    const defer = libQ.defer();
    if (uri.startsWith('napster/track/')) {
         axios.get(apiUrl + '/v2.2/tracks/' + uri.split('/')[2], {
             headers: {
                 "Apikey": apiKey,
                 "User-Agent": userAgent,
                 'X-Px-Authorization': '3'
             }
         }).then(function (resp) {
             let response = [self.parseNapsterTrack(resp.data["tracks"][0])];
             defer.resolve(response);
         }).catch(function (err) {
                defer.reject(err);
         });
    } else {
        defer.reject(new Error('napster: unknown uri type: ' + uri));
    }
    return defer.promise;
}

napster.prototype.goto = function (data) {
    const self = this;
    const defer = libQ.defer();
    // Handle go to artist and go to album function

    return defer.promise;
};
