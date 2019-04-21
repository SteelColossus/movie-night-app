import { View } from './view.js';
import { appendTableRow, sumVotes } from './viewFunctions.js';

export class VoteView extends View {
    constructor(socket, animTime) {
        super('vote', socket, animTime);
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

                                    this.socket.emit('votes_changed', voteDeltas);
                                });

                            if (movie.votes[this.userToken] != null && movie.votes[this.userToken] >= 1) {
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

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    buildMovieTable(movies, votingSystem) {
        const movieTable = $('<table>')
            .attr('id', 'movieTable')
            .addClass('table');

        const headings = ['Movie', 'Year', 'Runtime', 'Genre', 'Plot', 'IMDB Rating', null, 'Votes'];

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

        this.addSocketListener('votes_changed', this.handleVotesChanged);

        if (this.isHost === true) {
            this.addDOMListener(this.closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).show(this.animTime);
        }
    }

    onViewHidden() {
        this.closeVotingButton.hide();
        this.voteDisplay.empty();
    }
}