const socket = io();
const movieTable = $('#movieTable');

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('setup', (info) => {
    // Remove all the existing movies
    movieTable.find('tr:not(:first-child)').remove();

    for (let i = 0; i < info.movies.length; i++) {
        const tableRow = $('<tr>');
        const firstCell = $('<td>').text(info.movies[i].name);
        const secondCell = $('<td>');
        const thirdCell = $('<td>').attr('votes-for', info.movies[i].id);

        switch (info.votingSystem) {
            case 'multi-vote': {
                const voteButton = $('<input>')
                    .attr('type', 'button')
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
                    
                secondCell.append(voteButton);
                break;
            }
        }

        // Sum all of the votes
        const totalVotes = Object.values(info.movies[i].votes).reduce((a, b) => a + b, 0);

        thirdCell.text(totalVotes);

        tableRow.append(firstCell).append(secondCell).append(thirdCell);
        movieTable.append(tableRow);
    }

    // Show the table
    movieTable.removeAttr('hidden');
});

socket.on('votes_changed', (newVotes) => {
    Object.keys(newVotes).forEach((key) => {
        const votesCell = movieTable.find(`td[votes-for=${key}]`);
        const totalVotes = Object.values(newVotes[key]).reduce((a, b) => a + b, 0);
        const fadeMilliseconds = 150;

        votesCell.fadeOut(fadeMilliseconds, () => {
            votesCell.text(totalVotes);
            votesCell.fadeIn(fadeMilliseconds);
        });
    });
});