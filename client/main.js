const socket = io();
const client = new ClientJS();

// DOM elements
const movieTable = $('#movieTable');
const suggestTable = $('#suggestionTable');
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

        $('#suggestionsSection').show(defaultAnimationTime);
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

class VotePage extends Page {
    constructor() {
        super('vote');
    }

    appendMovieToTable(movie, votingSystem) {
        const tableRow = $('<tr>');
        const firstCell = $('<td>').text(movie.title);
        const secondCell = $('<td>').text(movie.year);
        const thirdCell = $('<td>').text(movie.runtime);
        const fourthCell = $('<td>').text(movie.genre);
        const fifthCell = $('<td>').text(movie.plot);
        const sixthCell = $('<td>').text(movie.rating);
        const seventhCell = $('<td>').text(movie.awards);
        const eighthCell = $('<td>').css('display', 'none');
        const ninthCell = $('<td>').attr('votes-for', movie.id).css('display', 'none');
    
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
    
                eighthCell.append(voteButton);
                break;
            }
        }
    
        // Sum all of the votes
        const totalVotes = sumVotes(movie.votes);
    
        ninthCell.text(totalVotes);
        tableRow.append(firstCell).append(secondCell).append(thirdCell).append(fourthCell).append(fifthCell).append(sixthCell).append(seventhCell).append(eighthCell).append(ninthCell);
        movieTable.append(tableRow);
    
        if (movie.suggester === userToken) {
            tableRow.addClass('suggester-row');
        }
    
        return tableRow;
    }

    setupMovies(movies, votingSystem) {
        // Remove all the existing movies
        movieTable.find('tr:not(:first-child)').remove();

        movies.forEach(movie => this.appendMovieToTable(movie, votingSystem));
    }

    handleVotesChanged(newVotes) {
        Object.keys(newVotes).forEach((key) => {
            const votesCell = movieTable.find(`td[votes-for=${key}]`);
            const totalVotes = sumVotes(newVotes[key]);
            const fadeMilliseconds = 150;
    
            votesCell.fadeOut(fadeMilliseconds, () => {
                votesCell.text(totalVotes);
                votesCell.fadeIn(fadeMilliseconds);
            });
        });
    }

    enableVoting() {
        this.isVotingEnabled = true;

        movieTable.find('tr th:nth-last-child(2), tr th:last-child, tr td:nth-last-child(2), tr td:last-child').show(defaultAnimationTime);
    
        if (this.isHost === true) {
            $('#closeVotingButton').show(defaultAnimationTime).click(() => {
                $('#closeVotingButton').hide();
                socket.emit('close_voting');
            });
        }
    }

    onPageShown() {
        this.setupMovies(this.movies, this.votingSystem);

        socket.on('new_movie', (movie) => {
            const movieRow = this.appendMovieToTable(movie);
            movieRow.hide().show(defaultAnimationTime);
        });

        socket.on('votes_changed', newVotes => this.handleVotesChanged(newVotes));

        if (this.isVotingEnabled === true) {
            this.enableVoting();
        }
        else if (this.isVotingEnabled === false && this.isHost === true) {
            $('#closeSuggestionsButton').show(defaultAnimationTime).click(() => {
                $('#closeSuggestionsButton').hide();
                socket.emit('close_suggestions');
            });
        }
    }

    onPageHidden() {
        $('#closeVotingButton').hide();
        movieTable.find('tr th:nth-last-child(2), tr th:last-child, tr td:nth-last-child(2), tr td:last-child').hide();
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
    votePage.isHost = info.isHost;
    votePage.movies = info.movies;
    votePage.votingSystem = info.votingSystem;
    votePage.isVotingEnabled = false;
    switchPage(votePage);
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
            votePage.isVotingEnabled = true;
            votePage.enableVoting();
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