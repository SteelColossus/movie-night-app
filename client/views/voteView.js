import { View } from './view.js';
import { createTableRow, sumVotes, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink } from './viewFunctions.js';

export class VoteView extends View {
    constructor(socket, animTime, userToken, isHost, movies, votingSystem, isExactPhase) {
        super(VoteView.viewName, socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
        this.votingSystem = votingSystem;
        this.isExactPhase = isExactPhase;
        this.voteView = $('#voteView');
    }

    createMultiVoteTableRow(movie) {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell) => setAsMovieDetailsLink(cell, movie.id)
            },
            { text: movie.year },
            { text: getTimeStringFromRuntime(movie.runtime) },
            { text: movie.genre },
            { text: movie.plot },
            {
                text: movie.rating,
                func: (cell) => setBackgroundColorRedToGreen(cell)
            },
            {
                func: (cell) => {
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

                    if (this.isExactPhase === false) {
                        voteButton.prop('disabled', true);
                    }

                    if (movie.votes[this.userToken] != null && movie.votes[this.userToken] >= 1) {
                        voteButton.addClass('active').attr('aria-pressed', 'true');
                    }

                    cell.addClass('vote-cell');
                    cell.append(voteButton);
                }
            },
            {
                text: sumVotes(movie.votes),
                func: (cell) => cell.attr('votes-for', movie.id)
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    createRandomTableRow(movie) {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell) => setAsMovieDetailsLink(cell, movie.id)
            }
        ]);

        tableRow.attr('movie-id', movie.id);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    handleVotesChanged(newVotes) {
        Object.keys(newVotes).forEach((key) => {
            const votesCell = this.voteView.find(`td[votes-for=${key}]`);
            const totalVotes = sumVotes(newVotes[key]);
            const fadeMilliseconds = 150;

            votesCell.fadeOut(fadeMilliseconds, () => {
                votesCell.text(totalVotes).fadeIn(fadeMilliseconds);
            });
        });
    }

    handleMovieRemoved(removedMovieId) {
        const movieRow = this.voteView.find(`tr[movie-id=${removedMovieId}]`);
        movieRow.fadeOut(this.animTime * 3, () => {
            movieRow.hide();
        });

        const removedMovie = this.movies.find((movie) => movie.id === removedMovieId);
        removedMovie.removed = true;
    }

    setupMultiVoteView() {
        const viewHtml = `
            <h5>Choose a movie to vote for below:</h5>
            <table id="voteTable" class="table">
                <thead>
                    <tr>
                        <th scope="col">Movie</th>
                        <th scope="col">Year</th>
                        <th scope="col">Runtime</th>
                        <th scope="col">Genre</th>
                        <th scope="col">Plot</th>
                        <th scope="col">IMDB Rating</th>
                        <th></th>
                        <th scope="col">Votes</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
            <input id="closeVotingButton" type="button" class="btn btn-danger mb-2" value="Close Voting" style="display: none">
        `;

        this.voteView.html(viewHtml);

        const voteTableBody = $('#voteTable > tbody');

        this.movies.forEach((movie) => {
            if (movie.removed === false) {
                const tableRow = this.createMultiVoteTableRow(movie);
                voteTableBody.append(tableRow);
            }
        });

        this.addSocketListener('votes_changed', this.handleVotesChanged);

        if (this.isHost === true && this.isExactPhase === true) {
            const closeVotingButton = $('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).show(this.animTime);
        }
    }

    setupRandomView() {
        const viewHtml = `
            <h5>Cross your fingers!</h5>
            <table id="voteTable" class="table">
                <thead>
                    <tr>
                        <th scope="col">Movie</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
            <input id="nextButton" type="button" class="btn btn-dark mb-2" value="Next" style="display: none">
        `;

        this.voteView.html(viewHtml);

        const voteTableBody = $('#voteTable > tbody');

        this.movies.forEach((movie) => {
            if (movie.removed === false) {
                const tableRow = this.createRandomTableRow(movie);
                voteTableBody.append(tableRow);
            }
        });

        this.addSocketListener('movie_removed', this.handleMovieRemoved);

        if (this.isHost === true && this.isExactPhase === true) {
            const nextButton = $('#nextButton');

            this.addDOMListener(nextButton, 'click', () => {
                let numRemainingMovies = 0;

                this.movies.forEach((movie) => {
                    if (movie.removed === false) {
                        numRemainingMovies += 1;
                    }
                });

                if (numRemainingMovies > 1) {
                    this.socket.emit('remove_random_movie');
                } else {
                    this.socket.emit('close_voting');
                }
            }).show(this.animTime);
        }
    }

    onViewShown() {
        switch (this.votingSystem) {
            case constants.VOTING_SYSTEMS.MULTI_VOTE:
                this.setupMultiVoteView();
                break;
            case constants.VOTING_SYSTEMS.RANDOM:
                this.setupRandomView();
                break;
            default:
                throw new Error(`Unknown voting system '${this.votingSystem}'.`);
        }
    }

    onViewHidden() {
        this.voteView.empty();
    }
}

VoteView.viewName = 'vote';