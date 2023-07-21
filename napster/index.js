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
    if (self.config.get('email') !== '') self.refreshToken();

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
        // TODO: register as device?
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

napster.prototype.refreshToken = async function () {
    const self = this;
    const params = new URLSearchParams({
            'client_id': apiKey,
            'client_secret': 'MTRjZTVjM2EtOGVlZi00OTU3LWFmNjktNTllODFhNmYyNzI5',
            'response_type': 'code',
            'grant_type': 'refresh_token',
            'refresh_token': self.config.get('refresh_token')
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
    }).catch(async function () {
        await self.login(self.config.get('email'), self.config.get('password'));
    })
}

napster.prototype.getStreamUrl = async function (track) {
    const self = this;
    if (self.config.get('expires_at') < Date.now() + 60 * 60 * 1000) await self.refreshToken();
    let resp = await axios.get(apiUrl + '/v3/streams/tracks?bitDepth=' + track.bitdepth + '&bitrate=' + track.bitrate + '&format=' + encodeURI(track.format) + '&id=' + track.id + '&sampleRate=' + track.samplerate, {
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

napster.prototype.browseTracks = async function () {
    const self = this;
    // &lang=en_US
    // TODO: limit, language
    let response = await axios.get(apiUrl + '/v2.2/me/library/tracks?limit=200&offset=0&rights=2', {
        headers: {
            'Authorization': 'Bearer ' + self.config.get('access_token'),
            'User-Agent': userAgent,
            'X-Px-Authorization': '3'
        }
    })
    let items = [];
    for (let track of response.data.tracks) {
        items.push(self.parseNapsterTrack(track))
    }
    let resp = {
        navigation: {
            prev: {
                uri: "napster"
            },
            lists: [
                {
                    availableListViews: ["list", "grid"],
                    items: items,
                    title: "Tracks",
                    icon: "fa fa-folder-open-o"
                }
            ]
        }
    }
    return libQ.resolve(resp);
};

napster.prototype.browseAlbums = async function () {
    const self = this;
    // &lang=en_US
    // TODO: limit, language
    let response = await axios.get(apiUrl + '/v2.2/me/library/albums?limit=20&offset=0&rights=2', {
        headers: {
            'Authorization': 'Bearer ' + self.config.get('access_token'),
            'User-Agent': userAgent,
            'X-Px-Authorization': '3'
        }
    })
    let items = [];
    for (let album of response.data.albums) {
        items.push({
            service: 'napster',
            type: 'playlist',
            title: album.name,
            artist: album.artistName,
            album: "",
            albumart: self.getAlbumImg(album.id),
            uri: 'napster/album/' + album.id
        })
    }
    let resp = {
        navigation: {
            prev: {
                uri: "napster"
            },
            lists: [
                {
                    availableListViews: ["list", "grid"],
                    items: items,
                    title: "Albums",
                    icon: "fa fa-folder-open-o"
                }
            ]
        }
    }
    return libQ.resolve(resp);
};

napster.prototype.browsePlaylists = async function () {
    const self = this;
    // &lang=en_US
    // TODO: limit
    // my_own_playlists
    let response = await axios.get(apiUrl + '/v2.2/me/search/playlists?include_private=true&limit=50&offset=0&sampleArtists=verbose&sort=modified_date&source=my_favorite_playlists', {
        headers: {
            'Authorization': 'Bearer ' + self.config.get('access_token'),
            'User-Agent': userAgent,
            'X-Px-Authorization': '3'
        }
    })
    let items = [];
    for (let playlist of response.data.playlists) {
        let creator = await axios.get(playlist.links.members.href, {
            headers: {
                "Apikey": apiKey,
                "User-Agent": userAgent,
                'X-Px-Authorization': '3'
            }
        })
        items.push({
            service: 'napster',
            type: 'playlist',
            title: playlist.name,
            artist: creator.data["members"][0]["realName"],
            album: "",
            albumart: playlist.images.url,
            uri: 'napster/playlist/' + playlist.id
        })
    }
    let resp = {
        navigation: {
            prev: {
                uri: "napster"
            },
            lists: [
                {
                    availableListViews: ["list", "grid"],
                    items: items,
                    title: "Playlists",
                    icon: "fa fa-folder-open-o"
                }
            ]
        }
    }
    return libQ.resolve(resp);
};

napster.prototype.handleBrowseUri = async function (curUri) {
    const self = this;
    let response;

    if (curUri.startsWith('napster')) {
        if (curUri === 'napster') {
            // TODO: station support https://web.archive.org/web/20230205095343/https://developer.prod.napster.com/api/v2.2#stations
            response = libQ.resolve({
                navigation: {
                    prev: {
                        uri: 'napster'
                    },
                    lists: [
                        {
                            "title": "My Music",
                            "icon": "fa fa-folder-open-o",
                            "availableListViews": ["list", "grid"],
                            "items": [
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Playlists',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/playlisticon.png',
                                    uri: 'napster/playlists'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Favorites',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/favouritesicon.png',
                                    uri: 'napster/favorites'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Tracks',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-music',
                                    uri: 'napster/tracks'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Albums',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/albumicon.png',
                                    uri: 'napster/albums'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'My Top Plays',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/last_100/icon.png',
                                    uri: 'napster/charts'
                                }
                            ]
                        },
                        {
                            "title": "Napster",
                            "icon": "fa fa-folder-open-o",
                            "availableListViews": ["list", "grid"],
                            "items": [
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Moods & Genres',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/genreicon.png',
                                    uri: 'napster/genres'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Tracks',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-music',
                                    uri: 'napster/popular/tracks'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Albums',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/albumicon.png',
                                    uri: 'napster/popular/albums'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'Popular Artists',
                                    artist: '',
                                    album: '',
                                    albumart: '/albumart?sourceicon=music_service/mpd/artisticon.png',
                                    uri: 'napster/popular/artists'
                                },
                                {
                                    service: 'napster',
                                    type: 'folder',
                                    title: 'New Releases',
                                    artist: '',
                                    album: '',
                                    icon: 'fa fa-music',
                                    uri: 'napster/new_releases'
                                }
                            ]
                        }
                    ]
                }
            });
        } else if (curUri.startsWith('napster/albums')) {
            response = await self.browseAlbums();
        } else if (curUri.startsWith('napster/tracks')) {
            response = await self.browseTracks();
        } else if (curUri.startsWith('napster/playlists')) {
            response = await self.browsePlaylists();
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
                let selectedTrackBlock = self.commandRouter.stateMachine.getTrack(self.commandRouter.stateMachine.currentPosition);
                if (selectedTrackBlock.service && selectedTrackBlock.service === 'napster') {
                    self.mpdPlugin.clientMpd.once('system-player', napsterListenerCallback);
                    return self.pushState(state);
                } else {
                    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster: Not a napster track, removing listener');
                }
            });
    };

    self.getStreamUrl(track).then(r => {
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

napster.prototype.seek = function (position) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::seek to ' + position);
    return this.mpdPlugin.seek(position);
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

napster.prototype.pause = function () {
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::pause');

    return self.mpdPlugin.pause()
        .then(function() {
            return self.mpdPlugin.getState()
                .then(function(state) {
                    return self.pushState(state);
                });
        });
};

napster.prototype.resume = function() {
    const self = this;
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
    const self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'napster::prefetch');

    self.getStreamUrl(nextTrack).then(r => {
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
    } else if (uri.startsWith('napster/album')) {
        axios.get('https://api.napster.com/v2.2/albums/' + uri.split('/')[2] + "/tracks", {
            headers: {
                "Apikey": apiKey,
                "User-Agent": userAgent,
                'X-Px-Authorization': '3'
            }
        }).then(function (response) {
            if (response.data.albums.length > 0) {
                let album = response.data.albums[0];
                let tracks = [];
                for (let track of album.tracks) {
                    tracks.push(self.parseNapsterTrack(track))
                }
                defer.resolve(tracks);
            } else {
                defer.reject(new Error('napster album not found'));
            }
        });
    } else if (uri.startsWith('napster/playlist')) {
        // TODO: handle 200 max limit with offset
        axios.get('/v2.2/me/library/playlists/' + uri.split('/')[2] + "/tracks?limit=200&offset=0&rights=0", {
            headers: {
                'Authorization': 'Bearer ' + self.config.get('access_token'),
                "User-Agent": userAgent,
                'X-Px-Authorization': '3'
            }
        }).then(function (response) {
            if (response.data.tracks.length > 0) {
                let tracks = [];
                for (let track of response.data.tracks) {
                    tracks.push(self.parseNapsterTrack(track))
                }
                defer.resolve(tracks);
            } else {
                defer.reject(new Error('napster playlist not found'));
            }
        });
    } else {
        //TODO: support other types?
        defer.reject(new Error('napster uri unknown'));
    }

    return defer.promise;
};

napster.prototype.getAlbumArt = function (data, path) {
    //TODO: what is this?
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
    // https://web.archive.org/web/20230205095343/https://developer.prod.napster.com/api/v2.2#images-apis
    // TODO: other sizes on search etc
    // TODO: configurable size
    return apiUrl + "/imageserver/v2/albums/" + id + "/images/500x500.jpg"
}


napster.prototype.search = function (query) {
    const self = this;
    const defer = libQ.defer();
    // TODO: configurable per_type_limit
    // &lang=en_US &rights=2
    axios.get(apiUrl + '/v2.2/search?catalog=' + self.config.get('catalog') + '&offset=0&per_type_limit=30&query=' + encodeURI(query.value.toLowerCase()) + '&rights=2&type=album,artist,track,playlist', {
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
    let selected
    //TODO: improve selection
    //TODO: config for format selection
    if (data["losslessFormats"] !== undefined && data["losslessFormats"].length > 0) {
        selected = data["losslessFormats"][data["losslessFormats"].length - 1];
    } else {
        selected = data["formats"][data["formats"].length - 1];
    }
    return {
        service: "napster",
        type: "song",
        title: data["name"],
        duration: data["playbackSeconds"],
        name: data["name"],
        artist: data["artistName"],
        album: data["albumName"],
        // TODO: really the album not track art?
        albumart: self.getAlbumImg(data["albumId"]),
        uri: 'napster/track/' + data["id"],
        id: data["id"],
        bitrate: selected["bitrate"],
        format: selected["name"],
        bitdepth: selected["sampleBits"],
        samplerate: selected["sampleRate"],
        trackType: (selected["name"].toLowerCase().startsWith("aac")) ? "aac" : selected["name"].toLowerCase(),
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
