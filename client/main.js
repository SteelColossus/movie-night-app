const socket = io();

// DOM elements
const movieTable = $('#movieTable');
const suggestTable = $('#suggestionTable');
const movieForm = $('#movieSearchForm');
const startForm = $('#startVotingForm');

let votingSystem = null;
const sections = {
    "host": true,
    "search": false,
    "suggestions": false,
    "vote": false
};
const sectionAnimationTime = 400;

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
        if (key === section) {
            showSection(key);
        }
        else {
            hideSection(key);
        }
    });
}

function appendMovieToTable(movie) {
    const tableRow = $('<tr>');
    const firstCell = $('<td>').text(movie.title);
    const secondCell = $('<td>').text(movie.runtime);
    const thirdCell = $('<td>').text(movie.genre);
    const fourthCell = $('<td>').text(movie.plot);
    const fifthCell = $('<td>').text(movie.rating);
    const sixthCell = $('<td>').text(movie.awards);
    const seventhCell = $('<td>');
    const eighthCell = $('<td>').attr('votes-for', movie.id);
    
    switch (votingSystem) {
        case "multi-vote": {
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
            seventhCell.append(voteButton);
            break;
        }
    }
    
    // Sum all of the votes
    const totalVotes = Object.values(movie.votes).reduce((a, b) => a + b, 0);

    eighthCell.text(totalVotes);
    tableRow.append(firstCell).append(secondCell).append(thirdCell).append(fourthCell).append(fifthCell).append(sixthCell).append(seventhCell).append(eighthCell);
    movieTable.append(tableRow);

    return tableRow;
}

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

//Start the movie night
startForm.submit(() => {
    let name = $('#nightName').val();
    let votingStyle = $('#votingSystem').val();
    let setupDetails = {name, votingStyle};
    //Allow suggestions
    socket.emit('setup_details', setupDetails);
    switchSection('search');
    //Stops refresh and connect of new user
    return false;
});

//Set room then start suggesting
socket.on('join_movie_night', (roomName) => {
    socket.emit('join_movie_night', roomName);
    switchSection('search');
});

//Get suggestion input
movieForm.submit(() => {
    let suggestion = $('#suggestion').val();

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
        const voteCell = $('<td>');
        const voteButton = $('<input>')
            .prop('type', 'button')
            .val('Choose!')
            .addClass('btn btn-primary')
            .attr('data-toggle', 'button')
            .attr('aria-pressed', 'false')
            .data('movie-id', searchResults[x].id)
            .click(() => {
                socket.emit('movie_chosen', voteButton.data('movie-id'));
            });

        voteCell.append(voteButton);
        tableRow.append(suggestionCell).append(voteCell);
        suggestTable.append(tableRow);
    }

    showSection('suggestions');
});

socket.on('setup', (info) => {
    votingSystem = info.votingSystem;

    // Remove all the existing movies
    movieTable.find('tr:not(:first-child)').remove();

    for (let i = 0; i < info.movies.length; i++) {
        appendMovieToTable(info.movies[i]);
    }

    // Show the table
    switchSection('vote');
});

socket.on('new_movie', (movie) => {
    const movieRow = appendMovieToTable(movie);
    movieRow.hide().fadeIn();
});

socket.on('votes_changed', (newVotes) => {
    Object.keys(newVotes).forEach((key) => {
        const votesCell = movieTable.find(`td[votes-for=${key}]`);
        console.log(votesCell);
        const totalVotes = Object.values(newVotes[key]).reduce((a, b) => a + b, 0);
        const fadeMilliseconds = 150;

        votesCell.fadeOut(fadeMilliseconds, () => {
            votesCell.text(totalVotes);
            votesCell.fadeIn(fadeMilliseconds);
        });
    });
});