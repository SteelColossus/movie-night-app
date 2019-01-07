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

// The unique ClientJS token of the current browser
let userToken = null;
// Whether this client believes it should be authenticated
let authenticated = false;
// The view that is currently being shown
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
    if (authenticated === false) {
        movieNightTitle.add(usernameIndicator).hide(animTime);

        const usernameView = new UsernameView(socket, animTime);
        usernameView.userToken = userToken;
        switchView(usernameView);
    }
    else {
        // The app server has likely been restarted - refresh the page to prevent side effects
        location.reload();
    }
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(animTime);
});

socket.on('setup_movies', (info) => {
    const suggestionsView = new SuggestionsView(socket, animTime);
    suggestionsView.isHost = info.isHost;
    suggestionsView.movies = info.movies;
    suggestionsView.userToken = userToken;
    switchView(suggestionsView);
});

socket.on('new_phase', (phaseInfo) => {
    authenticated = true;

    switch (phaseInfo.name) {
        case constants.HOST: {
            const hostView = new HostView(socket, animTime);
            hostView.votingSystems = phaseInfo.data.votingSystems;
            switchView(hostView);
            break;
        }
        case constants.SUGGEST: {
            const searchView = new SearchView(socket, animTime);
            searchView.errorMessage = errorMessage;
            switchView(searchView);
            break;
        }
        case constants.VOTE: {
            const voteView = new VoteView(socket, animTime);
            voteView.isHost = phaseInfo.isHost;
            voteView.movies = phaseInfo.data.movies;
            voteView.votingSystem = phaseInfo.data.votingSystem;
            voteView.userToken = userToken;
            switchView(voteView);
            break;
        }
        case constants.RESULTS: {
            const resultsView = new ResultsView(socket, animTime);
            resultsView.isHost = phaseInfo.isHost;
            resultsView.movies = phaseInfo.data.movies;
            resultsView.winner = phaseInfo.data.winner;
            switchView(resultsView);
            break;
        }
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