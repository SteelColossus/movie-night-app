import { View } from './view.js';
import { createTableRow, sumVotes, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink } from './viewFunctions.js';

export class VoteView extends View {
    constructor(socket, animTime, userToken, isHost, movies, votingSystem, numUsers, liveVoting, isExactPhase) {
        super(VoteView.viewName, socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
        this.votingSystem = votingSystem;
        this.numUsers = numUsers;
        this.liveVoting = liveVoting;
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
                        .addClass('btn btn-primary vote-button')
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
                text: this.liveVoting === true ? sumVotes(movie.votes) : 0,
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

    createRankedTableRow(movie, rank) {
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
                text: rank,
                func: (cell) => {
                    cell.addClass('rank-cell')
                        .data('movie-id', movie.id);
                }
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    createVetoTableRow(movie) {
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
                    const vetoButton = $('<input>')
                        .prop('type', 'button')
                        .val('Veto!')
                        .addClass('btn btn-primary veto-button')
                        .prop('disabled', true)
                        .click(() => {
                            this.socket.emit('remove_movie', movie.id);
                        });

                    cell.addClass('veto-cell');
                    cell.append(vetoButton);
                }
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        tableRow.attr('movie-id', movie.id);

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
            <div>
                <input id="lockInButton" type="button" class="btn btn-primary mb-2" value="Lock-in votes" data-toggle="button" aria-pressed="false">
                <input id="closeVotingButton" type="button" class="btn btn-danger mb-2" value="Close Voting" style="display: none">
            </div>
        `;

        this.voteView.html(viewHtml);

        const voteTableBody = $('#voteTable > tbody');

        this.movies.forEach((movie) => {
            const tableRow = this.createMultiVoteTableRow(movie);
            voteTableBody.append(tableRow);
        });

        if (this.liveVoting === true) {
            this.addSocketListener('votes_changed', this.handleVotesChanged);
        } else {
            voteTableBody.parent().addClass('not-live');
        }

        const lockInButton = $('#lockInButton')
            .click(() => {
                const disabled = lockInButton.is('.active') === false;
                lockInButton.blur();
                $('.vote-button').prop('disabled', disabled);
            });

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
            const tableRow = this.createRandomTableRow(movie);
            voteTableBody.append(tableRow);
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

    setupRankedView() {
        const viewHtml = `
            <link href="/views/external/jquery-ui.min.css" rel="stylesheet">

            <style>
            @media (max-width: 992px) {
                #rankedTableContainer {
                    margin-left: 20px;
                    margin-right: 20px;
                }
            }

            #voteTable > tbody.rank-sortable > tr:hover {
                cursor: move;
                background-color: #e1e1e1;
            }

            body.dark-mode #voteTable > tbody.rank-sortable > tr:hover {
                background-color: #3c3c3c;
            }
            </style>

            <h5>Re-arrange the movies in the order you most want to watch them:</h5>
            <div id="rankedTableContainer">
                <table id="voteTable" class="table">
                    <thead>
                        <tr>
                            <th scope="col">Movie</th>
                            <th scope="col">Year</th>
                            <th scope="col">Runtime</th>
                            <th scope="col">Genre</th>
                            <th scope="col">Plot</th>
                            <th scope="col">IMDB Rating</th>
                            <th scope="col">Rank</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div>
                <input id="lockInButton" type="button" class="btn btn-primary mb-2" value="Lock-in votes" data-toggle="button" aria-pressed="false">
                <input id="closeVotingButton" type="button" class="btn btn-danger mb-2" value="Close Voting" style="display: none">
            </div>

            <script src="/views/external/jquery-ui.min.js"></script>
            <script src="/views/external/jquery.ui.touch-punch.min.js"></script>
        `;

        this.voteView.html(viewHtml);

        const voteTableBody = $('#voteTable > tbody');
        voteTableBody.addClass('rank-sortable');

        let rank = 1;

        const initialVoteDeltas = {};

        this.movies = this.movies.sort((movieA, movieB) => movieB.votes[this.userToken] - movieA.votes[this.userToken]);

        this.movies.forEach((movie) => {
            if (movie.votes[this.userToken] == null || movie.votes[this.userToken] === 0) {
                initialVoteDeltas[movie.id] = this.movies.length - rank + 1;
            }

            const tableRow = this.createRankedTableRow(movie, rank);
            voteTableBody.append(tableRow);

            rank += 1;
        });

        if (Object.keys(initialVoteDeltas).length !== 0) {
            this.socket.emit('votes_changed', initialVoteDeltas);
        }

        voteTableBody.sortable({
            update: () => {
                const rankCells = voteTableBody.find('.rank-cell');

                const changedVoteDeltas = {};

                for (let i = 0; i < rankCells.length; i++) {
                    const rankCell = $(rankCells[i]);
                    const currentRank = Number.parseInt(rankCell.text(), 10);
                    const newRank = i + 1;

                    if (newRank !== currentRank) {
                        const movieId = rankCell.data('movie-id');
                        changedVoteDeltas[movieId] = currentRank - newRank;
                        rankCell.text(newRank);
                    }
                }

                if (Object.keys(changedVoteDeltas).length !== 0) {
                    this.socket.emit('votes_changed', changedVoteDeltas);
                }
            }
        });

        const lockInButton = $('#lockInButton')
            .click(() => {
                const disabled = lockInButton.is('.active') === false;
                lockInButton.blur();
                voteTableBody.sortable(disabled ? 'disable' : 'enable');
                voteTableBody.toggleClass('rank-sortable');
            });

        if (this.isHost === true && this.isExactPhase === true) {
            const closeVotingButton = $('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).show(this.animTime);
        }
    }

    setupVetoView() {
        const viewHtml = `
            <h5>It is <span id="vetoUser" class="font-weight-bold"></span>'s turn to choose a movie to veto:</h5>
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
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        this.voteView.html(viewHtml);

        const voteTableBody = $('#voteTable > tbody');
        const vetoUserText = $('#vetoUser');

        this.movies.forEach((movie) => {
            const tableRow = this.createVetoTableRow(movie);
            voteTableBody.append(tableRow);
        });

        this.addSocketListener('movie_removed', (removedMovieId) => {
            this.handleMovieRemoved(removedMovieId);

            let numRemainingMovies = 0;

            this.movies.forEach((movie) => {
                if (movie.removed === false) {
                    numRemainingMovies += 1;
                }
            });

            if (numRemainingMovies <= this.numUsers) {
                this.socket.emit('close_voting');
            }
        });

        this.addSocketListener('get_chosen_user', (user) => {
            const enableButtons = this.isExactPhase === true && this.userToken === user.token;

            $('.veto-button').prop('disabled', !enableButtons);
            vetoUserText.text(user.username);
        });

        this.socket.emit('get_chosen_user');
    }

    onViewShown() {
        this.movies = this.movies.filter((movie) => movie.removed === false);

        switch (this.votingSystem) {
            case constants.VOTING_SYSTEMS.MULTI_VOTE:
                this.setupMultiVoteView();
                break;
            case constants.VOTING_SYSTEMS.RANDOM:
                this.setupRandomView();
                break;
            case constants.VOTING_SYSTEMS.RANKED:
                this.setupRankedView();
                break;
            case constants.VOTING_SYSTEMS.VETO:
                this.setupVetoView();
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