import { UsernameView } from './views/usernameView.js';
import { HostView } from './views/hostView.js';
import { SearchView } from './views/searchView.js';
import { SuggestionsView } from './views/suggestionsView.js';
import { VoteView } from './views/voteView.js';
import { ResultsView } from './views/resultsView.js';

const socket = io();
const client = new ClientJS();

// Shared DOM elements
const movieNightTitle = $('#movieNightTitle');
const errorMessage = $('#errorMessage');
const usernameIndicator = $('#usernameIndicator');

const animTime = 400;

const usernameView = new UsernameView(socket, animTime);
const hostView = new HostView(socket, animTime);
const searchView = new SearchView(socket, animTime);
const suggestionsView = new SuggestionsView(socket, animTime);
const voteView = new VoteView(socket, animTime);
const resultsView = new ResultsView(socket, animTime);

let userToken = null;
let currentView = null;

function switchView(view) {
    if (currentView == null || currentView.viewName !== view.viewName) {
        errorMessage.hide(animTime);

        if (currentView != null) currentView.hide();
        view.show();

        currentView = view;
    }
}

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('request_user_token', () => {
    userToken = client.getFingerprint();
    socket.emit('user_token', userToken);
});

socket.on('request_new_user', () => {
    movieNightTitle.add(usernameIndicator).hide(animTime);
    usernameView.userToken = userToken;
    switchView(usernameView);
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(animTime);
});

socket.on('setup_movies', (info) => {
    suggestionsView.isHost = info.isHost;
    suggestionsView.movies = info.movies;
    suggestionsView.userToken = userToken;
    switchView(suggestionsView);
});

socket.on('new_phase', (phaseInfo) => {
    switch (phaseInfo.name) {
        case constants.HOST:
            hostView.votingSystems = phaseInfo.data.votingSystems;
            switchView(hostView);
            break;
        case constants.SUGGEST:
            searchView.errorMessage = errorMessage;
            switchView(searchView);
            break;
        case constants.VOTE:
            voteView.isHost = phaseInfo.isHost;
            voteView.movies = phaseInfo.data.movies;
            voteView.votingSystem = phaseInfo.data.votingSystem;
            voteView.userToken = userToken;
            switchView(voteView);
            break;
        case constants.RESULTS:
            resultsView.isHost = phaseInfo.isHost;
            resultsView.movies = phaseInfo.data.movies;
            resultsView.winner = phaseInfo.data.winner;
            switchView(resultsView);
            break;
    }

    if (phaseInfo.data != null && phaseInfo.data.name != null) {
        movieNightTitle.text(phaseInfo.data.name).show(animTime);
    }
    else {
        movieNightTitle.hide(animTime);
    }

    if (phaseInfo.username != null) {
        usernameIndicator.text(phaseInfo.username).show(animTime);
    }
});