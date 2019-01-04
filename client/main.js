const socket = io();
const client = new ClientJS();

// Shared DOM elements
const movieNightTitle = $('#movieNightTitle');
const errorMessage = $('#errorMessage');

const defaultAnimationTime = 400;

let userToken = null;

function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

class Page {
    constructor(name) {
        this.name = name;
        this.container = $(`#${name}Page`);
    }

    show() {
        this.container.show(defaultAnimationTime);
        this.onPageShown();
    }

    hide() {
        this.container.hide(defaultAnimationTime);
        this.onPageHidden();
    }

    onPageShown() {
        // Since this is emulating an abstract class, we do nothing here
    }

    onPageHidden() {
        // Since this is emulating an abstract class, we do nothing here
    }
}

class UsernamePage extends Page {
    constructor() {
        super('username');
    }

    formSubmit() {
        let username = $('#username').val().toString().trim();
    
        socket.emit('new_user', {
            "token": userToken,
            "username": username
        });
    
        //Stops refresh and connect of new user
        return false;
    }

    onPageShown() {
        $('#usernameForm').submit(this.formSubmit);
    }
}

class HostPage extends Page {
    constructor() {
        super('host');
    }

    formSubmit() {
        let name = $('#nightName').val().toString().trim();
        let votingSystem = $('#votingSystem').val();
        let setupDetails = {
            "name": name,
            "votingSystem": votingSystem
        };

        //Allow suggestions
        socket.emit('setup_details', setupDetails);

        //Stops refresh and connect of new user
        return false;
    }

    onPageShown() {
        this.votingSystems.forEach((system) => {
            $('#votingSystem').append($('<option>').val(system).text(system));
        });

        $('#startVotingForm').submit(this.formSubmit);
    }
}

class SearchPage extends Page {
    constructor() {
        super('search');
    }

    //Get suggestion input
    formSubmit() {
        let suggestion = $('#suggestion').val().toString().trim();

        if (suggestion.length > 0) {
            socket.emit('movie_search', suggestion);
        }
    
        //Stops refresh and connect of new user
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

        for (let x = 0; x < searchResults.length; x++) {
            const tableRow = $('<tr>');
            const suggestionCell = $('<td>').text(searchResults[x].title);
            const yearCell = $('<td>').text(searchResults[x].year);
            const chooseCell = $('<td>');
            const chooseButton = $('<input>')
                .prop('type', 'button')
                .val('Choose!')
                .addClass('btn btn-primary')
                .attr('data-toggle', 'button')
                .attr('aria-pressed', 'false')
                .data('movie-id', searchResults[x].id)
                .click(() => {
                    socket.emit('movie_chosen', chooseButton.data('movie-id'));
                });

            chooseCell.append(chooseButton);
            tableRow.append(suggestionCell).append(yearCell).append(chooseCell);
            suggestTable.append(tableRow);
        }

        $('#searchResults').show(defaultAnimationTime);
    }

    onPageShown() {
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

        $('#movieSearchForm').submit(this.formSubmit);
        
        //Form suggestion table from api results
        socket.on('movie_search', searchData => this.handleSearch(searchData));
    }

    onPageHidden() {
        $('#closeSuggestionsButton').hide();
    }
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

class SuggestionsPage extends Page {
    constructor() {
        super('suggestions');
        this.movieTable = $('#movieTable');
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

    onPageShown() {
        this.buildSuggestionsTable(this.movies);

        socket.on('new_movie', (movie) => {
            const movieRow = this.appendMovieToTable(movie);
            movieRow.hide().show(defaultAnimationTime);
        });

        if (this.isHost === true) {
            $('#closeSuggestionsButton').show(defaultAnimationTime).click(() => {
                $('#closeSuggestionsButton').hide();
                socket.emit('close_suggestions');
            });
        }
    }

    onPageHidden() {
        // Remove all the existing movies
        this.movieTable.find('tr:not(:first-child)').remove();
    }
}

class VotePage extends Page {
    constructor() {
        super('vote');
        this.voteDisplay = $('#voteDisplay');
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
    
    onPageShown() {
        this.buildVoteDisplay(this.movies, this.votingSystem);

        socket.on('votes_changed', newVotes => this.handleVotesChanged(newVotes));

        if (this.isHost === true) {
            $('#closeVotingButton').show(defaultAnimationTime).click(() => {
                $('#closeVotingButton').hide();
                socket.emit('close_voting');
            });
        }
    }

    onPageHidden() {
        this.voteDisplay.empty();
    }
}

class ResultsPage extends Page {
    constructor() {
        super('results');
    }

    createChart(movies) {
        const ctx = $('#voteChart');
        const labels = [];
        const votes = [];
    
        for (let x = 0; x < movies.length; x++) {
            labels[x] = movies[x].title;
            votes[x] = sumVotes(movies[x].votes);
        }

        const myChart = new Chart(ctx, { // eslint-disable-line no-unused-vars
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
    }

    onPageShown() {
        // Show different text if there were no votes for any movies
        $('#winner').text((this.winner != null) ? `Winner is ${this.winner.title} with ${this.winner.votes} vote${this.winner.votes !== 1 ? 's' : ''}!` : 'No one voted for any movies!');

        if (this.winner != null) {
            this.createChart(this.movies);
        }
        else {
            $('#voteChart').hide();
        }

        if (this.isHost === true) {
            $('#endButton').show(defaultAnimationTime).click(() => {
                $('#endButton').hide();
                socket.emit('end');
            });

            $('#newMovieButton').show(defaultAnimationTime).click(() => {
                $('#newMovieButton').hide();
                socket.emit('new_round');
            });
        }
    }
}

const usernamePage = new UsernamePage();
const hostPage = new HostPage();
const searchPage = new SearchPage();
const suggestionsPage = new SuggestionsPage();
const votePage = new VotePage();
const resultsPage = new ResultsPage();

let currentPage = hostPage;

function switchPage(page) {
    if (currentPage.name !== page.name) {
        errorMessage.hide(defaultAnimationTime);

        currentPage.hide();
        page.show();

        currentPage = page;
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
    $('#movieNightTitle, #usernameIndicator').hide(defaultAnimationTime);
    switchPage(usernamePage);
});

socket.on('request_new_username', () => {
    errorMessage.text('The name you have entered is already taken.').show(defaultAnimationTime);
});

socket.on('setup_movies', (info) => {
    suggestionsPage.isHost = info.isHost;
    suggestionsPage.movies = info.movies;
    switchPage(suggestionsPage);
});

//Set room then start suggesting
socket.on('new_phase', (phaseInfo) => {
    switch (phaseInfo.name) {
        case constants.HOST:
            hostPage.votingSystems = phaseInfo.data.votingSystems;
            switchPage(hostPage);
            break;
        case constants.SUGGEST:
            switchPage(searchPage);
            break;
        case constants.VOTE:
            votePage.isHost = phaseInfo.isHost;
            votePage.movies = phaseInfo.data.movies;
            votePage.votingSystem = phaseInfo.data.votingSystem;
            switchPage(votePage);
            break;
        case constants.RESULTS:
            resultsPage.isHost = phaseInfo.isHost;
            resultsPage.movies = phaseInfo.data.movies;
            resultsPage.winner = phaseInfo.data.winner;
            switchPage(resultsPage);
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