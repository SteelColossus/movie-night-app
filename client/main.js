import { View } from './views/view.js';
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

function switchViewWithName(viewName, data = null, isHost = null, isExactPhase = true) {
    let view = null;

    switch (viewName) {
        case UsernameView.viewName:
            view = new UsernameView(socket, animTime, userToken);
            break;
        case HostView.viewName:
            view = new HostView(socket, animTime, data.votingSystems);
            break;
        case SearchView.viewName:
            view = new SearchView(socket, animTime);
            break;
        case SuggestionsView.viewName:
            view = new SuggestionsView(socket, animTime, userToken, isHost, data.movies, isExactPhase);
            break;
        case VoteView.viewName:
            view = new VoteView(socket, animTime, userToken, isHost, data.movies, data.votingSystem, isExactPhase);
            break;
        case ResultsView.viewName:
            view = new ResultsView(socket, animTime, isHost, data.movies, data.winner);
            break;
    }

    if (view != null) switchView(view);
}

function getViewPhase(viewName) {
    switch (viewName) {
        case HostView.viewName:
            return constants.PHASES.HOST;
        case SearchView.viewName:
        case SuggestionsView.viewName:
            return constants.PHASES.SUGGEST;
        case VoteView.viewName:
            return constants.PHASES.VOTE;
        case ResultsView.viewName:
            return constants.PHASES.RESULTS;
        default:
            return null;
    }
}

function requestViewDataForHash() {
    const viewName = location.hash.substring(1);

    // Special case as username has no phase associated with it
    if (viewName === UsernameView.viewName) {
        switchViewWithName(UsernameView.viewName);
    }

    if (currentView != null && viewName === currentView.viewName) return;

    const phaseName = getViewPhase(viewName);

    if (phaseName != null) {
        socket.emit('get_phase_data', phaseName);
    }
}

window.addEventListener('hashchange', () => {
    requestViewDataForHash();
});

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('request_user_token', () => {
    userToken = client.getFingerprint();
    socket.emit('user_token', userToken);
});

socket.on('request_new_user', () => {
    if (authenticated === false) {
        switchViewWithName(UsernameView.viewName);
    }
    else if (authenticated === true) {
        // The app server has likely been restarted - refresh the page to prevent side effects
        location.reload();
    }
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(animTime);
});

socket.on('user_info', (username) => {
    usernameIndicator.text(username).show(animTime);
});

socket.on('new_phase', (phaseInfo) => {
    authenticated = true;

    let switchPhaseView = true;

    // First check if the user has navigated straight to a particular view
    if (View.isFirst && location.hash.length > 0) {
        requestViewDataForHash();
        switchPhaseView = false;
    }

    if (switchPhaseView === true) {
        let viewName = null;

        switch (phaseInfo.name) {
            case constants.PHASES.HOST:
                viewName = HostView.viewName;
                break;
            case constants.PHASES.SUGGEST:
                viewName = (phaseInfo.data.doneSuggesting === true) ? SuggestionsView.viewName : SearchView.viewName;
                break;
            case constants.PHASES.VOTE:
                viewName = VoteView.viewName;
                break;
            case constants.PHASES.RESULTS:
                viewName = ResultsView.viewName;
                break;
        }

        if (viewName != null) switchViewWithName(viewName, phaseInfo.data, phaseInfo.isHost);
    }

    if (phaseInfo.data != null && phaseInfo.data.name != null) {
        movieNightTitle.text(phaseInfo.data.name).show(animTime);
    }
    else {
        movieNightTitle.hide(animTime);
    }
});

socket.on('movie_suggestions', (data) => {
    switchViewWithName(SuggestionsView.viewName, data, data.isHost);
});

socket.on('get_phase_data', (data) => {
    const viewName = location.hash.substring(1);
    switchViewWithName(viewName, data, data.isHost, data.isExactPhase);
});