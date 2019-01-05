const socket = io();
const client = new ClientJS();

// Shared DOM elements
const movieNightTitle = $('#movieNightTitle');
const errorMessage = $('#errorMessage');

const defaultAnimationTime = 400;

let userToken = null;
let currentView = null;

function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

function appendTableRow(table, objList) {
    const tableRow = $('<tr>');

    objList.forEach((obj) => {
        const cell = $('<td>');

        if (obj.text != null) {
            cell.text(obj.text);
        }

        if (obj.func != null) {
            obj.func(cell);
        }

        tableRow.append(cell);
    });

    table.append(tableRow);
    return tableRow;
}

function switchView(view) {
    if (currentView == null || currentView.viewName !== view.viewName) {
        errorMessage.hide(defaultAnimationTime);

        if (currentView != null) currentView.hide();
        view.show();

        currentView = view;
    }
}

class View {
    constructor(name) {
        this.viewName = name;
        this.container = $(`#${name}View`);
    }

    show() {
        this.container.show(defaultAnimationTime);
        this.onViewShown();
    }

    hide() {
        this.container.hide(defaultAnimationTime);
        this.onViewHidden();
    }

    onViewShown() {
        // Since this is emulating an abstract class, we do nothing here
    }

    onViewHidden() {
        // Since this is emulating an abstract class, we do nothing here
    }
}

class UsernameView extends View {
    constructor() {
        super('username');
        this.usernameInput = $('#username');
    }

    formSubmit(view) {
        let username = view.usernameInput.val().toString().trim();

        socket.emit('new_user', {
            "token": userToken,
            "username": username
        });

        // Stops refresh and connect of new user
        return false;
    }

    onViewShown() {
        $('#usernameForm').submit(() => this.formSubmit(this));
    }

    onViewHidden() {
        this.usernameInput.val('');
    }
}

class HostView extends View {
    constructor() {
        super('host');
        this.nightInput = $('#nightName');
    }

    formSubmit(view) {
        let name = view.nightInput.val().toString().trim();
        let votingSystem = $('#votingSystem').val();
        let setupDetails = {
            "name": name,
            "votingSystem": votingSystem
        };

        // Allow suggestions
        socket.emit('setup_details', setupDetails);

        // Stops refresh and connect of new user
        return false;
    }

    onViewShown() {
        this.votingSystems.forEach((system) => {
            $('#votingSystem').append($('<option>').val(system).text(system));
        });

        $('#startVotingForm').submit(() => this.formSubmit(this));
    }

    onViewHidden() {
        this.nightInput.val('');
    }
}

class SearchView extends View {
    constructor() {
        super('search');
        this.suggestionInput = $('#suggestion');
        this.searchResults = $('#searchResults');
    }

    // Get suggestion input
    formSubmit(view) {
        let suggestion = view.suggestionInput.val().toString().trim();

        if (suggestion.length > 0) {
            socket.emit('movie_search', suggestion);
        }

        // Stops refresh and connect of new user
        return false;
    }

    handleSearch(searchData) {
        if (searchData.success === false) {
            errorMessage.text(`Error: ${searchData.errorMessage}`).show(defaultAnimationTime);
            return;
        }

        errorMessage.hide(defaultAnimationTime);

        const suggestTable = $('#suggestionTable');

        // Remove all the existing suggestions
        suggestTable.find('tr:not(:first-child)').remove();

        let searchResults = searchData.results;

        searchResults.forEach((result) => {
            appendTableRow(suggestTable, [
                { "text": result.title },
                { "text": result.year },
                {
                    "func": (cell) => {
                        const chooseButton = $('<input>')
                            .prop('type', 'button')
                            .val('Choose!')
                            .addClass('btn btn-primary')
                            .attr('data-toggle', 'button')
                            .attr('aria-pressed', 'false')
                            .data('movie-id', result.id)
                            .click(() => {
                                socket.emit('movie_chosen', chooseButton.data('movie-id'));
                            });

                        cell.append(chooseButton);
                    }
                }
            ]);
        });

        this.searchResults.show(defaultAnimationTime);
    }

    onViewShown() {
        $('#movieInfo').popover({
            "trigger": "hover focus",
            "placement": "bottom",
            "html": true,
            "title": "Movie Night Rules:",
            "content": `
                <ul>
                    <li>NO documentaries</li>
                    <li>NO shorts</li>
                    <li>NO anime</li>
                    <li>NO series</li>
                    <li>NO porn</li>
                    <li>NO anime series</li>
                    <li>NO anime porn series</li>
                </ul>
            `
        });

        $('#movieSearchForm').submit(() => this.formSubmit(this));

        // Form suggestion table from API results
        socket.on('movie_search', searchData => this.handleSearch(searchData));
    }

    onViewHidden() {
        this.suggestionInput.val('');
        this.searchResults.hide();
    }
}

class SuggestionsView extends View {
    constructor() {
        super('suggestions');
        this.movieTable = $('#movieTable');
        this.closeSuggestionsButton = $('#closeSuggestionsButton');
    }

    appendMovieToTable(movie) {
        const tableRow = appendTableRow(this.movieTable, [
            { "text": movie.title },
            { "text": movie.year },
            { "text": movie.runtime },
            { "text": movie.genre },
            { "text": movie.plot },
            { "text": movie.rating },
            { "text": movie.awards }
        ]);

        if (movie.suggester === userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    buildSuggestionsTable(movies) {
        movies.forEach(movie => this.appendMovieToTable(movie));
    }

    onViewShown() {
        this.buildSuggestionsTable(this.movies);

        socket.on('new_movie', (movie) => {
            const movieRow = this.appendMovieToTable(movie);
            movieRow.hide().show(defaultAnimationTime);
        });

        if (this.isHost === true) {
            this.closeSuggestionsButton.show(defaultAnimationTime).click(() => {
                socket.emit('close_suggestions');
            });
        }
    }

    onViewHidden() {
        this.closeSuggestionsButton.hide();
        // Remove all the existing movies
        this.movieTable.find('tr:not(:first-child)').remove();
    }
}

class VoteView extends View {
    constructor() {
        super('vote');
        this.voteDisplay = $('#voteDisplay');
        this.closeVotingButton = $('#closeVotingButton');
    }

    appendMovieToTable(movieTable, movie, votingSystem) {
        const tableRow = appendTableRow(movieTable, [
            { "text": movie.title },
            { "text": movie.year },
            { "text": movie.runtime },
            { "text": movie.genre },
            { "text": movie.plot },
            { "text": movie.rating },
            { "text": movie.awards },
            {
                "func": (cell) => {
                    switch (votingSystem) {
                        case constants.MULTI_VOTE: {
                            const voteButton = $('<input>')
                                .prop('type', 'button')
                                .val('Vote!')
                                .addClass('btn btn-primary')
                                .attr('data-toggle', 'button')
                                .attr('aria-pressed', 'false')
                                .click(() => {
                                    const voteDeltas = {};

                                    // Inverted because the class has not been added at the point of the click event firing
                                    voteDeltas[movie.id] = (!voteButton.is('.active')) ? 1 : -1;

                                    socket.emit('votes_changed', voteDeltas);
                                });

                            if (movie.votes[userToken] != null && movie.votes[userToken] >= 1) {
                                voteButton.addClass('active').attr('aria-pressed', 'true');
                            }

                            cell.append(voteButton);
                            break;
                        }
                    }
                }
            },
            {
                "text": sumVotes(movie.votes),
                "func": (cell) => {
                    cell.attr('votes-for', movie.id);
                }
            }
        ]);

        if (movie.suggester === userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    buildMovieTable(movies, votingSystem) {
        const movieTable = $('<table>').addClass('table');

        const headings = ['Movie', 'Year', 'Runtime', 'Genre', 'Plot', 'IMDB Rating', 'Awards', null, 'Votes'];

        const headingRow = $('<tr>');

        headings.forEach((heading) => {
            const headingCell = $('<th>');

            if (heading != null && heading.length > 0) {
                headingCell.text(heading).attr('scope', 'col');
            }

            headingRow.append(headingCell);
        });

        movieTable.append(headingRow);

        movies.forEach(movie => this.appendMovieToTable(movieTable, movie, votingSystem));

        this.voteDisplay.append(movieTable);
    }

    buildVoteDisplay(movies, votingSystem) {
        // Later on we may include more esoteric voting systems (e.g. World Cup voting) which may not display as tables, hence the purpose of this function
        this.buildMovieTable(movies, votingSystem);
    }

    handleVotesChanged(newVotes) {
        Object.keys(newVotes).forEach((key) => {
            const votesCell = this.voteDisplay.find(`td[votes-for=${key}]`);
            const totalVotes = sumVotes(newVotes[key]);
            const fadeMilliseconds = 150;

            votesCell.fadeOut(fadeMilliseconds, () => {
                votesCell.text(totalVotes).fadeIn(fadeMilliseconds);
            });
        });
    }

    onViewShown() {
        this.buildVoteDisplay(this.movies, this.votingSystem);

        socket.on('votes_changed', newVotes => this.handleVotesChanged(newVotes));

        if (this.isHost === true) {
            this.closeVotingButton.show(defaultAnimationTime).click(() => {
                socket.emit('close_voting');
            });
        }
    }

    onViewHidden() {
        this.closeVotingButton.hide();
        this.voteDisplay.empty();
    }
}

class ResultsView extends View {
    constructor() {
        super('results');
        this.canvas = $('#voteChart');
        this.endButton = $('#endButton');
        this.newMovieButton = $('#newMovieButton');
    }

    createChart(movies) {
        const labels = [];
        const votes = [];

        movies.forEach((movie) => {
            labels.push(movie.title);
            votes.push(sumVotes(movie.votes));
        });

        this.voteChart = new Chart(this.canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '# of Votes',
                    data: votes,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                }
            }
        });

        this.canvas.show();
    }

    onViewShown() {
        // Show different text if there were no votes for any movies
        $('#winner').text((this.winner != null) ? `Winner is ${this.winner.title} with ${this.winner.votes} vote${this.winner.votes !== 1 ? 's' : ''}!` : 'No one voted for any movies!');

        if (this.winner != null) {
            this.createChart(this.movies);
        }

        if (this.isHost === true) {
            this.endButton.show(defaultAnimationTime).click(() => {
                socket.emit('end');
            });

            this.newMovieButton.show(defaultAnimationTime).click(() => {
                socket.emit('new_round');
            });
        }
    }

    onViewHidden() {
        this.endButton.hide();
        this.newMovieButton.hide();
        // Destroy the existing chart so that a new one can be created
        this.voteChart.destroy();
        this.canvas.hide();
    }
}

const usernameView = new UsernameView();
const hostView = new HostView();
const searchView = new SearchView();
const suggestionsView = new SuggestionsView();
const voteView = new VoteView();
const resultsView = new ResultsView();

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('request_user_token', () => {
    userToken = client.getFingerprint();
    socket.emit('user_token', userToken);
});

socket.on('request_new_user', () => {
    $('#movieNightTitle, #usernameIndicator').hide(defaultAnimationTime);
    switchView(usernameView);
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(defaultAnimationTime);
});

socket.on('setup_movies', (info) => {
    suggestionsView.isHost = info.isHost;
    suggestionsView.movies = info.movies;
    switchView(suggestionsView);
});

socket.on('new_phase', (phaseInfo) => {
    switch (phaseInfo.name) {
        case constants.HOST:
            hostView.votingSystems = phaseInfo.data.votingSystems;
            switchView(hostView);
            break;
        case constants.SUGGEST:
            switchView(searchView);
            break;
        case constants.VOTE:
            voteView.isHost = phaseInfo.isHost;
            voteView.movies = phaseInfo.data.movies;
            voteView.votingSystem = phaseInfo.data.votingSystem;
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
        movieNightTitle.text(phaseInfo.data.name).show(defaultAnimationTime);
    }
    else {
        movieNightTitle.hide(defaultAnimationTime);
    }

    if (phaseInfo.username != null) {
        $('#usernameIndicator').text(phaseInfo.username).show(defaultAnimationTime);
    }
});