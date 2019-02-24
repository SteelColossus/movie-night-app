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
        switchView(new UsernameView(socket, animTime, userToken));
    }
    else if (authenticated === true) {
        // The app server has likely been restarted - refresh the page to prevent side effects
        location.reload();
    }
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(animTime);
});

socket.on('new_phase', (phaseInfo) => {
    authenticated = true;

    switch (phaseInfo.name) {
        case constants.HOST: {
            switchView(new HostView(socket, animTime, phaseInfo.data.votingSystems));
            break;
        }
        case constants.SUGGEST: {
            switchView(new SearchView(socket, animTime));
            break;
        }
        case constants.VOTE: {
            switchView(new VoteView(socket, animTime, userToken, phaseInfo.isHost, phaseInfo.data.movies, phaseInfo.data.votingSystem));
            break;
        }
        case constants.RESULTS: {
            switchView(new ResultsView(socket, animTime, phaseInfo.isHost, phaseInfo.data.movies, phaseInfo.data.winner));
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
    else {
        usernameIndicator.hide(animTime);
    }
});

socket.on('movie_suggestions', (info) => {
    switchView(new SuggestionsView(socket, animTime, userToken, info.isHost, info.movies));
});