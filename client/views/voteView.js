import { View } from './view.js';
import { createTableRow, sumVotes, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink } from './viewFunctions.js';
import { VOTING_SYSTEMS } from '../../server/constants.js';

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
        this.voteView = document.querySelector('#voteView');
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
                    const voteButton = document.createElement('input');
                    voteButton.type = 'button';
                    voteButton.value = 'Vote!';
                    voteButton.classList.add('btn', 'btn-primary', 'vote-button');
                    voteButton.dataset.bsToggle = 'button';
                    voteButton.addEventListener('click', () => {
                        const voteDeltas = {};

                        voteDeltas[movie.id] = voteButton.matches('.active') ? 1 : -1;

                        this.socket.emit('votes_changed', voteDeltas);
                    });

                    if (this.isExactPhase === false) {
                        voteButton.disabled = true;
                    }

                    if (movie.votes[this.userToken] != null && movie.votes[this.userToken] >= 1) {
                        voteButton.classList.add('active');
                    }

                    cell.classList.add('vote-cell');
                    cell.append(voteButton);
                }
            },
            {
                text: this.liveVoting === true ? sumVotes(movie.votes) : 0,
                func: (cell) => cell.setAttribute('votes-for', movie.id)
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.classList.add('suggester-row');
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

        tableRow.setAttribute('movie-id', movie.id);

        if (movie.suggester === this.userToken) {
            tableRow.classList.add('suggester-row');
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
                    cell.classList.add('rank-cell');
                    cell.dataset.movieId = movie.id;
                }
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.classList.add('suggester-row');
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
                    const vetoButton = document.createElement('input');
                    vetoButton.type = 'button';
                    vetoButton.value = 'Veto!';
                    vetoButton.classList.add('btn', 'btn-primary', 'veto-button');
                    vetoButton.disabled = true;
                    vetoButton.addEventListener('click', () => {
                        this.socket.emit('remove_movie', movie.id);
                    });

                    cell.classList.add('veto-cell');
                    cell.append(vetoButton);
                }
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.classList.add('suggester-row');
        }

        tableRow.setAttribute('movie-id', movie.id);

        return tableRow;
    }

    handleVotesChanged(newVotes) {
        Object.keys(newVotes).forEach((key) => {
            const votesCell = this.voteView.querySelector(`td[votes-for=${key}]`);
            const totalVotes = sumVotes(newVotes[key]);
            const fadeMilliseconds = 150;

            votesCell.textContent = totalVotes;
            votesCell.style.display = '';
        });
    }

    handleMovieRemoved(removedMovieId) {
        const movieRow = this.voteView.querySelector(`tr[movie-id=${removedMovieId}]`);
        movieRow.style.display = 'none';

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
                <input id="lockInButton" type="button" class="btn btn-primary mb-2" value="Lock-in votes" data-bs-toggle="button" aria-pressed="false">
                <input id="closeVotingButton" type="button" class="btn btn-danger mb-2" value="Close Voting" style="display: none">
            </div>
        `;

        this.voteView.innerHTML = viewHtml;

        const voteTableBody = document.querySelector('#voteTable > tbody');

        this.movies.forEach((movie) => {
            const tableRow = this.createMultiVoteTableRow(movie);
            voteTableBody.append(tableRow);
        });

        if (this.liveVoting === true) {
            this.addSocketListener('votes_changed', this.handleVotesChanged);
        } else {
            voteTableBody.parentElement.classList.add('not-live');
        }

        const lockInButton = document.querySelector('#lockInButton');
        lockInButton.addEventListener('click', () => {
            const disabled = lockInButton.matches('.active') === true;
            lockInButton.blur();
            document.querySelector('.vote-button').disabled = disabled;
        });

        if (this.isHost === true && this.isExactPhase === true) {
            const closeVotingButton = document.querySelector('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).style.display = '';
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

        this.voteView.innerHTML = viewHtml;

        const voteTableBody = document.querySelector('#voteTable > tbody');

        this.movies.forEach((movie) => {
            const tableRow = this.createRandomTableRow(movie);
            voteTableBody.append(tableRow);
        });

        this.addSocketListener('movie_removed', this.handleMovieRemoved);

        if (this.isHost === true && this.isExactPhase === true) {
            const nextButton = document.querySelector('#nextButton');

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
            }).style.display = '';
        }
    }

    setupRankedView() {
        const viewHtml = `
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
                <input id="lockInButton" type="button" class="btn btn-primary mb-2" value="Lock-in votes" data-bs-toggle="button" aria-pressed="false">
                <input id="closeVotingButton" type="button" class="btn btn-danger mb-2" value="Close Voting" style="display: none">
            </div>
        `;

        this.voteView.innerHTML = viewHtml;

        const voteTableBody = document.querySelector('#voteTable > tbody');
        voteTableBody.classList.add('rank-sortable');

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

        const sortableVoteTable = new Sortable(voteTableBody, {
            update: () => {
                const rankCells = voteTableBody.querySelector('.rank-cell');

                const changedVoteDeltas = {};

                for (let i = 0; i < rankCells.length; i++) {
                    const rankCell = document.querySelector(rankCells[i]);
                    const currentRank = Number.parseInt(rankCell.textContext, 10);
                    const newRank = i + 1;

                    if (newRank !== currentRank) {
                        const movieId = rankCell.dataset.movieId;
                        changedVoteDeltas[movieId] = currentRank - newRank;
                        rankCell.textContext = newRank;
                    }
                }

                if (Object.keys(changedVoteDeltas).length !== 0) {
                    this.socket.emit('votes_changed', changedVoteDeltas);
                }
            }
        });

        const lockInButton = document.querySelector('#lockInButton');
        lockInButton.addEventListener('click', () => {
            const disabled = lockInButton.is('.active') === true;
            lockInButton.blur();
            sortableVoteTable.disabled = disabled;
            voteTableBody.classList.toggle('rank-sortable');
        });

        if (this.isHost === true && this.isExactPhase === true) {
            const closeVotingButton = document.querySelector('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).style.display = '';
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

        this.voteView.innerHTML = viewHtml;

        const voteTableBody = document.querySelector('#voteTable > tbody');
        const vetoUserText = document.querySelector('#vetoUser');

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

            document.querySelector('.veto-button').disabled = !enableButtons;
            vetoUserText.textContent = user.username;
        });

        this.socket.emit('get_chosen_user');
    }

    onViewShown() {
        this.movies = this.movies.filter((movie) => movie.removed === false);

        switch (this.votingSystem) {
            case VOTING_SYSTEMS.MULTI_VOTE:
                this.setupMultiVoteView();
                break;
            case VOTING_SYSTEMS.RANDOM:
                this.setupRandomView();
                break;
            case VOTING_SYSTEMS.RANKED:
                this.setupRankedView();
                break;
            case VOTING_SYSTEMS.VETO:
                this.setupVetoView();
                break;
            default:
                throw new Error(`Unknown voting system '${this.votingSystem}'.`);
        }
    }

    onViewHidden() {
        this.voteView.replaceChildren();
    }
}

VoteView.viewName = 'vote';