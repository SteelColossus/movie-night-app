const socket = io();
const client = new ClientJS();

// DOM elements
const movieTable = $('#movieTable');
const suggestTable = $('#suggestionTable');
const movieForm = $('#movieSearchForm');
const startForm = $('#startVotingForm');
const usernameForm = $('#usernameForm');
const movieNightTitle = $('#movieNightTitle');

const sections = {
    "username": false,
    "host": false,
    "search": false,
    "suggestions": false,
    "vote": false,
    "results": false
};
const defaultAnimationTime = 400;

let votingSystem = null;
let userToken = null;

function showSection(section) {
    sections[section] = true;
    $(`#${section}Section`).show(defaultAnimationTime);
}

function hideSection(section) {
    sections[section] = false;
    $(`#${section}Section`).hide(defaultAnimationTime);
}

function switchSection(section) {
    Object.keys(sections).forEach((key) => {
        if (key === section && sections[key] === false) {
            showSection(key);
        }
        else if (key !== section && sections[key] === true) {
            hideSection(key);
        }
    });
}

function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

function appendMovieToTable(movie) {
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

function setupMovies(info) {
    votingSystem = info.votingSystem;

    // Remove all the existing movies
    movieTable.find('tr:not(:first-child)').remove();

    for (let i = 0; i < info.movies.length; i++) {
        appendMovieToTable(info.movies[i]);
    }

    // Show the table
    switchSection('vote');
}

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('request_user_token', () => {
    userToken = client.getFingerprint();
    socket.emit('user_token', userToken);
});

socket.on('request_new_user', () => {
    // TODO: Find a better way to do this
    $('#movieNightTitle, #errorMessage, #usernameIndicator').hide(defaultAnimationTime);
    switchSection('username');
});

//Start the movie night
startForm.submit(() => {
    let name = $('#nightName').val().toString().trim();
    if (name === '') {
        $('#errorMessage').text('Stop hacking, please enter movie night name').show(defaultAnimationTime);
    }
    else {
        $('#errorMessage').hide(defaultAnimationTime);

        let votingStyle = $('#votingSystem').val();
        let setupDetails = {
            "name": name,
            "votingSystem": votingStyle
        };
        //Allow suggestions
        socket.emit('setup_details', setupDetails);
        switchSection('search');
    }

    //Stops refresh and connect of new user
    return false;
});

usernameForm.submit(() => {
    let username = usernameForm.find('#username').val();

    socket.emit('new_user', {
        "token": userToken,
        "username": username
    });

    //Stops refresh and connect of new user
    return false;
});

function createChart(data) {
    const ctx = $('#voteChart');
    const movies = data.movies;
    const labels = [];
    const votes = [];
    const winner = { "movie": "", "votes": 0 };

    for (let x = 0; x < movies.length; x++) {
        labels[x] = movies[x].title;
        votes[x] = sumVotes(movies[x].votes);
        if (votes[x] > winner.votes) {
            winner.movie = labels[x];
            winner.votes = votes[x];
        }
    }

    $('#winner').text(`Winner is ${winner.movie} with ${winner.votes} vote${winner.votes > 1 ? 's' : ''}!`);

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

//Set room then start suggesting
socket.on('new_phase', (phaseInfo) => {
    switch (phaseInfo.name) {
        case constants.HOST:
            switchSection('host');

            phaseInfo.data.votingSystems.forEach((system) => {
                $('#votingSystem').append($('<option>').val(system).text(system));
            });
            break;
        case constants.SUGGEST:
            switchSection('search');

            if (phaseInfo.isHost) {
                $('#closeSuggestionsButton').show(defaultAnimationTime).click(() => {
                    $('#closeSuggestionsButton').hide();
                    socket.emit('close_suggestions');
                });
            }

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
            break;
        case constants.VOTE:
            if (sections.vote === false) {
                setupMovies(phaseInfo.data);
            }

            movieTable.find('tr th:nth-last-child(2), tr th:last-child, tr td:nth-last-child(2), tr td:last-child').show(defaultAnimationTime);
            if (phaseInfo.isHost) {
                $('#closeVotingButton').show(defaultAnimationTime).click(() => {
                    $('#closeVotingButton').hide();
                    socket.emit('close_voting');
                });
            }
            break;
        case constants.RESULTS:
            hideSection('vote');
            showSection('results');
            createChart(phaseInfo.data);

            if (phaseInfo.isHost) {
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

    if (phaseInfo.data != null && phaseInfo.data.name != null) {
        movieNightTitle.text(phaseInfo.data.name).show(defaultAnimationTime);
    }
    else {
        movieNightTitle.hide(defaultAnimationTime);
    }

    if (phaseInfo.name !== 'suggest') {
        $('#closeSuggestionsButton').hide();
    }
    else if (phaseInfo.name !== 'vote') {
        $('#closeVotingButton').hide();
        movieTable.find('tr th:nth-last-child(2), tr th:last-child, tr td:nth-last-child(2), tr td:last-child').hide();
    }

    if (phaseInfo.username != null) {
        $('#usernameIndicator').text(phaseInfo.username).show(defaultAnimationTime);
    }
});

//Get suggestion input
movieForm.submit(() => {
    let suggestion = $('#suggestion').val().toString().trim();

    if (suggestion.length > 0) {
        $('#errorMessage').hide(defaultAnimationTime);

        socket.emit('movie_search', suggestion);
    }

    //Stops refresh and connect of new user
    return false;
});

//Form suggestion table from api results
socket.on('movie_search', (searchData) => {
    if (searchData.success === false) {
        $('#errorMessage').text(`Error: ${searchData.errorMessage}`).show(defaultAnimationTime);

        return;
    }

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

    showSection('suggestions');
});

socket.on('setup', (info) => {
    setupMovies(info);
});

socket.on('new_movie', (movie) => {
    const movieRow = appendMovieToTable(movie);
    movieRow.hide().fadeIn();
});

socket.on('votes_changed', (newVotes) => {
    Object.keys(newVotes).forEach((key) => {
        const votesCell = movieTable.find(`td[votes-for=${key}]`);
        const totalVotes = sumVotes(newVotes[key]);
        const fadeMilliseconds = 150;

        votesCell.fadeOut(fadeMilliseconds, () => {
            votesCell.text(totalVotes);
            votesCell.fadeIn(fadeMilliseconds);
        });
    });
});