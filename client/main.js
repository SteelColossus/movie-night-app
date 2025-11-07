import { View } from './views/view.js';
import { UsernameView } from './views/usernameView.js';
import { HostView } from './views/hostView.js';
import { SearchView } from './views/searchView.js';
import { SuggestionsView } from './views/suggestionsView.js';
import { VoteView } from './views/voteView.js';
import { ResultsView } from './views/resultsView.js';
import { PHASES } from '../server/constants.js';

const socket = io();
const client = new ClientJS();

// Shared DOM elements
const movieNightTitle = $('#movieNightTitle');
const errorMessage = $('#errorMessage');
const usernameIndicator = $('#usernameIndicator');
const darkModeButton = $('#darkModeButton');

const animTime = 400;

// The unique ClientJS token of the current browser
let userToken = null;
// Whether this client believes it should be authenticated
let authenticated = false;
// The view that is currently being shown
let currentView = null;

// Whether the page is currently in dark mode
let darkMode = localStorage.getItem('darkMode') === true.toString();

function switchView(view, forceRefresh = false) {
    if (currentView == null || currentView.viewName !== view.viewName || forceRefresh === true) {
        errorMessage.hide(animTime);

        if (currentView != null) {
            currentView.hide();
        }
        view.show();

        currentView = view;
    }
}

function switchViewWithName(
    viewName,
    data = null,
    isHost = null,
    isExactPhase = true,
    forceRefresh = false
) {
    let view = null;

    switch (viewName) {
        case UsernameView.viewName:
            view = new UsernameView(socket, animTime, userToken);
            break;
        case HostView.viewName:
            view = new HostView(socket, animTime, data.votingSystems, data.isPasswordRequired);
            break;
        case SearchView.viewName:
            view = new SearchView(socket, animTime, data.suggestedMovies, data.maxSuggestions);
            break;
        case SuggestionsView.viewName:
            view = new SuggestionsView(
                socket,
                animTime,
                userToken,
                isHost,
                data.movies,
                isExactPhase
            );
            break;
        case VoteView.viewName:
            view = new VoteView(
                socket,
                animTime,
                userToken,
                isHost,
                data.movies,
                data.votingSystem,
                data.numUsers,
                data.liveVoting,
                isExactPhase
            );
            break;
        case ResultsView.viewName:
            view = new ResultsView(socket, animTime, isHost, data.movies, data.winner, data.users);
            break;
        default:
            throw new Error(`Unknown view name '${viewName}'.`);
    }

    if (view != null) {
        switchView(view, forceRefresh);
    }
}

function getViewPhase(viewName) {
    switch (viewName) {
        case HostView.viewName:
            return PHASES.HOST;
        case SearchView.viewName:
        case SuggestionsView.viewName:
            return PHASES.SUGGEST;
        case VoteView.viewName:
            return PHASES.VOTE;
        case ResultsView.viewName:
            return PHASES.RESULTS;
        default:
            return null;
    }
}

function requestViewDataForHash() {
    const viewName = location.hash.substring(1);

    // Special cases for views that have no phases associated with them
    if (viewName === UsernameView.viewName) {
        switchViewWithName(UsernameView.viewName);
    }

    if (currentView != null && viewName === currentView.viewName) {
        return;
    }

    const phaseName = getViewPhase(viewName);

    if (phaseName != null) {
        socket.emit('get_phase_data', phaseName);
    }
}

function setDarkMode(isDarkMode) {
    localStorage.setItem('darkMode', darkMode);

    if (isDarkMode) {
        $(document.body).addClass('dark-mode');
        darkModeButton.find('.fa-moon').removeClass('fa-moon').addClass('fa-sun');
    } else {
        $(document.body).removeClass('dark-mode');
        darkModeButton.find('.fa-sun').removeClass('fa-sun').addClass('fa-moon');
    }
}

setDarkMode(darkMode);

darkModeButton.click(() => {
    darkMode = !darkMode;
    setDarkMode(darkMode);
});

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
    } else if (authenticated === true) {
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
            case PHASES.HOST:
                viewName = HostView.viewName;
                break;
            case PHASES.SUGGEST:
                viewName =
                    phaseInfo.data.suggestedMovies.length >= phaseInfo.data.maxSuggestions
                        ? SuggestionsView.viewName
                        : SearchView.viewName;
                break;
            case PHASES.VOTE:
                viewName = VoteView.viewName;
                break;
            case PHASES.RESULTS:
                viewName = ResultsView.viewName;
                break;
            default:
                throw new Error(`Unknown phase name '${phaseInfo.name}'.`);
        }

        if (viewName != null) {
            switchViewWithName(viewName, phaseInfo.data, phaseInfo.isHost);
        }
    }

    if (phaseInfo.data != null && phaseInfo.data.name != null) {
        movieNightTitle.text(phaseInfo.data.name).show(animTime);
    } else {
        movieNightTitle.hide(animTime);
    }
});

socket.on('movie_suggestions_done', (data) => {
    switchViewWithName(SuggestionsView.viewName, data, data.isHost);
});

socket.on('get_phase_data', (data) => {
    const viewName = location.hash.substring(1);
    switchViewWithName(viewName, data, data.isHost, data.isExactPhase);
});

socket.on('new_voting_stage', (data) => {
    switchViewWithName(VoteView.viewName, data, data.isHost, true, true);
});
