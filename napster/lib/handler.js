'use strict'

const apiUrl = 'https://api.napster.com';
const userAgent = 'android/8.1.9.1055/NapsterGlobal';
const napster = require('../index.js');

class handler {
    async login(email, password) {
        try {
        let resp = await fetch(apiUrl + '/oauth/token', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic WlRKbE9XTmhaR1V0TnpsbVpTMDBaR1UyTFRrd1lqTXRaRGsxT0RSbE1Ea3dPRE01Ok1UUmpaVFZqTTJFdE9HVmxaaTAwT1RVM0xXRm1Oamt0TlRsbE9ERmhObVl5TnpJNQ==',
                'User-Agent': userAgent,
                'X-Px-Authorization': '3',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'username': email,
                'password': password,
                'grant_type': 'password'
            })
        })
        resp = await resp.json();
        napster.prototype.config.set('access_token', resp['access_token']);
        napster.prototype.config.set('refresh_token', resp['refresh_token']);
        napster.prototype.config.set('expires_at', Date.now() + resp['expires_in'] * 1000);
        napster.prototype.config.set('catalog', resp['catalog']);
        return true;
        } catch (e) {
            return false;
        }
    }

    async getStreamUrl(trackId) {
        let resp = await fetch(apiUrl + '/v3/streams/tracks?bitDepth=16&bitrate=44100&format=FLAC&id=' + trackId + ' "&sampleRate=44100', {
            headers: {
                'Authorization': 'Bearer ' + napster.prototype.config.get('access_token'),
                'User-Agent': userAgent,
                'X-Px-Authorization': '3'
            }
        });
        resp = await resp.json();
        return resp['streams'][0]['primaryUrl'];
    }
}

module.exports = handler;