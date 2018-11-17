const socket = io();
const movieTable = $('#movieTable');

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('setup', (movies) => {
    // Remove all the existing movies
    movieTable.find('tr:not(:first-child)').remove();

    for (let i = 0; i < movies.length; i++) {
        const tableRow = $('<tr>');
        const firstCell = $('<td>').text(movies[i].name);
        const secondCell = $('<td>');
        const thirdCell = $('<td>').attr('votes-for', i);
        const voteButton = $('<input>')
            .prop('type', 'button')
            .val('Vote!')
            .addClass('btn btn-primary')
            .attr('data-toggle', 'button')
            .attr('aria-pressed', 'false')
            .click(() => {
            const voteDeltas = {};

            // Inverted because the class has not been added at the point of the click event firing
            voteDeltas[i] = (!voteButton.is('.active')) ? 1 : -1;

            socket.emit('votes_changed', voteDeltas);
        });

        // Sum all of the votes
        const totalVotes = Object.values(movies[i].votes).reduce((a, b) => a + b, 0);

        thirdCell.text(totalVotes);

        secondCell.append(voteButton);
        tableRow.append(firstCell).append(secondCell).append(thirdCell);
        movieTable.append(tableRow);
    }

    // Show the table
    movieTable.css('display', '');
});

socket.on('votes_changed', (voteDeltas) => {
    Object.keys(voteDeltas).forEach((key) => {
        const votesCell = movieTable.find(`td[votes-for=${key}]`);
        const currentVotes = parseInt(votesCell.text(), 10);
        votesCell.text(currentVotes + voteDeltas[key]);
    });
});