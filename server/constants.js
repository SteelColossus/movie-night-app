/* global window */
'use strict';

// Hack to be able to use this node module client side
if (typeof module === 'undefined') {
    window.exports = {};
}

// Stores all constants used by both the client and server

exports.VOTING_SYSTEMS = {
    MULTI_VOTE: 'Multi Vote',
    RANDOM: 'Random'
};

exports.PHASES = {
    HOST: 'host',
    SUGGEST: 'suggest',
    VOTE: 'vote',
    RESULTS: 'results'
};

// Hack to be able to use this node module client side
if (typeof module === 'undefined') {
    window.constants = window.exports;
    delete window.exports;
}