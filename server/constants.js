// Hack to be able to use this node module client side
if (typeof module === 'undefined') {
    window.exports = {};
}

// Stores all constants used by both the client and server

// Voting systems
exports.MULTI_VOTE = "Multi Vote";

exports.VOTING_SYSTEMS = [
    exports.MULTI_VOTE
];

// Phases
exports.HOST = "host";
exports.SUGGEST = "suggest";
exports.VOTE = "vote";
exports.RESULTS = "results";

exports.PHASES = [
    exports.HOST,
    exports.SUGGEST,
    exports.VOTE,
    exports.RESULTS
];

// Hack to be able to use this node module client side
if (typeof module === 'undefined') {
    window.constants = window.exports;
    delete window.exports;
}