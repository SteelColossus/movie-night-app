const socket = io();
const movieTable = $('#movieTable');
const suggestTable = $('#suggestionTable');
const form = $('#form');

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

//Get suggestion input
$('#form').submit(() => {
    let suggestion = $('#suggestion').val();
    socket.emit('suggest', suggestion);
    
    //Stops refresh and connect of new user
    return false;
});

//Form suggestion table from api results
socket.on('print', (print) => {
    suggestTable.find('tr:not(:first-child)').remove();

    for (let x = 0; x < print.length; x++) {
        const tableRow = $('<tr>');
        const suggestionCell = $('<td>').text(print[x].Title);
        const voteCell = $('<td>');
        const voteButton = $('<input>')
            .prop('type', 'button')
            .val('Choose!')
            .addClass('btn btn-primary')
            .attr('data-toggle', 'button')
            .attr('aria-pressed', 'false')
            .attr('data-title', print[x].Title)
            .click(() => {
                socket.emit('chosen', voteButton.attr('data-title'));
            });

        voteCell.append(voteButton);
        tableRow.append(suggestionCell).append(voteCell);
        suggestTable.append(tableRow);
    }

    suggestTable.parent().removeAttr('hidden');
});

socket.on('setup', (info) => {
    // Remove all the existing movies
    movieTable.find('tr:not(:first-child)').remove();

    for (let i = 0; i < info.movies.length; i++) {
        const tableRow = $('<tr>');
        const firstCell = $('<td>').text(info.movies[i].title);
        const secondCell = $('<td>').text(info.movies[i].runtime);
        const thirdCell = $('<td>').text(info.movies[i].genre);
        const fourthCell = $('<td>').text(info.movies[i].plot);
        const fifthCell = $('<td>').text(info.movies[i].rating);
        const sixthCell = $('<td>').text(info.movies[i].awards);
        const seventhCell = $('<td>');
        const eighthCell = $('<td>').attr('votes-for', info.movies[i].id);
        
        switch (info.votingSystem) {
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
                        voteDeltas[info.movies[i].id] = (!voteButton.is('.active')) ? 1 : -1;

                        socket.emit('votes_changed', voteDeltas);
                    });
                seventhCell.append(voteButton);
                break;
            }
        }
        
        // Sum all of the votes
        const totalVotes = Object.values(info.movies[i].votes).reduce((a, b) => a + b, 0);

        eighthCell.text(totalVotes);
        tableRow.append(firstCell).append(secondCell).append(thirdCell).append(fourthCell).append(fifthCell).append(sixthCell).append(seventhCell).append(eighthCell);
        movieTable.append(tableRow);
    }

    // Show the table
    form.attr('hidden', '');
    suggestTable.parent().attr('hidden', '');
    movieTable.parent().removeAttr('hidden');
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