const socket = io();
const movieTable = $('#movieTable');

socket.on('connect', () => {
    console.log('Connected to the app server.');
});

socket.on('setup', (movies) => {
    // Remove all the existing movies
    $(movieTable).find('tr:not(:first-child)').remove();

    for (let i = 0; i < movies.length; i++) {
        const tableRow = $('<tr>');
        const firstCell = $('<td>').text(movies[i].name);
        const secondCell = $('<td>');
        const thirdCell = $('<td>').attr('votes-for', i);
        const voteButton = $('<input>').prop('type', 'checkbox').change(() => {
            const voteDeltas = {};
            voteDeltas[i] = ($(voteButton).is(':checked')) ? 1 : -1;

            socket.emit('votes_changed', voteDeltas);
        });

        // Sum all of the votes
        const totalVotes = Object.values(movies[i].votes).reduce((a, b) => a + b, 0);

        $(thirdCell).text(totalVotes);

        $(secondCell).append(voteButton);
        $(tableRow).append(firstCell).append(secondCell).append(thirdCell);
        $(movieTable).append(tableRow);
    }
});

socket.on('votes_changed', (voteDeltas) => {
    Object.keys(voteDeltas).forEach((key) => {
        const votesCell = $(movieTable).find(`td[votes-for=${key}]`)[0];
        const currentVotes = parseInt($(votesCell).text(), 10);
        $(votesCell).text(currentVotes + voteDeltas[key]);
    });
});