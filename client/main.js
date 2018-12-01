const socket = io();

// DOM elements
const movieTable = $('#movieTable');
const suggestTable = $('#suggestionTable');
const movieForm = $('#movieSearchForm');
const startForm = $('#startVotingForm');
const movieNightTitle = $('#movieNightTitle');

const sections = {
    "host": false,
    "search": false,
    "suggestions": false,
    "vote": false,
    "results": false
};
const sectionAnimationTime = 400;

let inRoom = false;
let userToken = null;
let votingSystem = null;

function showSection(section) {
    sections[section] = true;
    $(`#${section}Section`).show(sectionAnimationTime);
}

function hideSection(section) {
    sections[section] = false;
    $(`#${section}Section`).hide(sectionAnimationTime);
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
        case 'multiVote': {
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
            eighthCell.append(voteButton);
            break;
        }
    }

    // Sum all of the votes
    const totalVotes = sumVotes(movie.votes);

    ninthCell.text(totalVotes);
    tableRow.append(firstCell).append(secondCell).append(thirdCell).append(fourthCell).append(fifthCell).append(sixthCell).append(seventhCell).append(eighthCell).append(ninthCell);
    movieTable.append(tableRow);

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

socket.on('user_token', (token) => {
    userToken = token;
});

//Start the movie night
startForm.submit(() => {
    let name = $('#nightName').val().toString().trim();
    if (name === '') {
        alert('Stop hacking, please enter movie night name');
    }
    else {
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

function createChart(data) {
    const ctx = $("#voteChart");
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

    $("#winner").text(`Winner is ${winner.movie} with ${winner.votes} votes!`);

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
        case 'host':
            switchSection('host');

            Object.keys(phaseInfo.data).forEach((key) => {
                $('#votingSystem').append($('<option>').val(key).text(phaseInfo.data[key]));
            });
            break;
        case 'suggest':
            switchSection('search');

            if (phaseInfo.data.host === userToken) {
                $('#closeSuggestionsButton').show(sectionAnimationTime).click(() => {
                    $('#closeSuggestionsButton').hide();
                    socket.emit('close_suggestions', 'vote');
                });
            }

            $('#movieInfo').popover({
                "trigger": "hover focus",
                "placement": "bottom",
                "html": true,
                "title": "Movie Night Rules:",
                "content": `
                    <ul>
                        <li>NO anime</li>
                        <li>NO series</li>
                        <li>NO porn</li>
                        <li>NO anime series</li>
                        <li>NO anime porn series</li>
                    </ul>
                `
            });
            break;
        case 'vote':
            if (sections.vote === false) {
                setupMovies(phaseInfo.data);
            }

            movieTable.find('tr th:nth-last-child(2), tr th:last-child, tr td:nth-last-child(2), tr td:last-child').show(sectionAnimationTime);
            if (phaseInfo.data.host === userToken) {
                $('#closeVotingButton').show(sectionAnimationTime).click(() => {
                    $('#closeVotingButton').hide();
                    socket.emit('close_voting', 'results');
                });
            }
            break;
        case 'results':
            hideSection('vote');
            showSection('results');
            createChart(phaseInfo.data);
            if (phaseInfo.data.host === userToken) {
                $('#endButton').show(sectionAnimationTime).click(() => {
                    $('#endButton').hide();
                    socket.emit('end', phaseInfo.data);
                });
            }
    }

    if (phaseInfo.data != null && phaseInfo.data.name != null) {
        if (!inRoom) {     
            socket.emit('join_movie_night', phaseInfo.data.name);
            inRoom = true;
        }

        if (movieNightTitle.css('display') === 'none') {
            movieNightTitle.text(phaseInfo.data.name).show(sectionAnimationTime);
        }
    }
    else {
        inRoom = false;
        movieNightTitle.hide(sectionAnimationTime);
    }
});

//Get suggestion input
movieForm.submit(() => {
    let suggestion = $('#suggestion').val().toString().trim();

    if (suggestion.length > 0) {
        $('#errorMessage').hide(sectionAnimationTime);

        socket.emit('movie_search', suggestion);
    }

    //Stops refresh and connect of new user
    return false;
});

//Form suggestion table from api results
socket.on('movie_search', (searchData) => {
    if (searchData.success === false) {
        $('#errorMessage').text(`Error: ${searchData.errorMessage}`).show(sectionAnimationTime);

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