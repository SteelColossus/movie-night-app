import type { Socket } from 'socket.io';

import type { SelectableMovie, User } from '../../server/common.js';
import { VOTING_SYSTEMS } from '../../server/constants.js';

import { View } from './view.js';
import { createTableRow, sumVotes, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink } from './viewFunctions.js';

export class VoteView extends View {
    public static readonly viewName = 'vote';

    private readonly userToken: number;

    private readonly isHost: boolean;

    private readonly movies: SelectableMovie[];

    private readonly votingSystem: string;

    private readonly numUsers: number;

    private readonly liveVoting: boolean;

    private readonly isExactPhase: boolean;

    private readonly voteView: JQuery;

    public constructor(
        socket: Socket, animTime: number, userToken: number, isHost: boolean, movies: SelectableMovie[],
        votingSystem: string, numUsers: number, liveVoting: boolean, isExactPhase: boolean
    ) {
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

    protected onViewShown(): void {
        let i = this.movies.length - 1;

        while (i >= 0) {
            if (this.movies[i].removed) {
                this.movies.splice(i, 1);
            }

            i -= 1;
        }

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

    protected onViewHidden(): void {
        this.voteView.empty();
    }

    private createMultiVoteTableRow(movie: SelectableMovie): JQuery {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell: JQuery): void => {
                    setAsMovieDetailsLink(cell, movie.id);
                }
            },
            { text: movie.year },
            { text: getTimeStringFromRuntime(movie.runtime) },
            { text: movie.genre },
            { text: movie.plot },
            {
                text: movie.rating,
                func: (cell: JQuery): void => {
                    setBackgroundColorRedToGreen(cell);
                }
            },
            {
                func: (cell: JQuery): void => {
                    const voteButton = $('<input>')
                        .prop('type', 'button')
                        .val('Vote!')
                        .addClass('btn btn-primary vote-button')
                        .attr('data-toggle', 'button')
                        .attr('aria-pressed', 'false')
                        .click(() => {
                            const voteDeltas = new Map<string, number>();

                            // Inverted because the class has not been added at the point of the click event firing
                            voteDeltas.set(movie.id, (!voteButton.is('.active')) ? 1 : -1);

                            this.socket.emit('votes_changed', voteDeltas);
                        });

                    if (this.isExactPhase) {
                        voteButton.prop('disabled', true);
                    }

                    const userVotes = movie.votes.get(this.userToken);

                    if (userVotes != null && userVotes >= 1) {
                        voteButton.addClass('active').attr('aria-pressed', 'true');
                    }

                    cell.addClass('vote-cell');
                    cell.append(voteButton);
                }
            },
            {
                text: (this.liveVoting ? sumVotes(movie.votes) : 0).toString(),
                func: (cell: JQuery): void => {
                    cell.attr('votes-for', movie.id);
                }
            }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    private createRandomTableRow(movie: SelectableMovie): JQuery {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell: JQuery): void => {
                    setAsMovieDetailsLink(cell, movie.id);
                }
            }
        ]);

        tableRow.attr('movie-id', movie.id);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    private createRankedTableRow(movie: SelectableMovie, rank: number): JQuery {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell: JQuery): void => {
                    setAsMovieDetailsLink(cell, movie.id);
                }
            },
            { text: movie.year },
            { text: getTimeStringFromRuntime(movie.runtime) },
            { text: movie.genre },
            { text: movie.plot },
            {
                text: movie.rating,
                func: (cell: JQuery): void => {
                    setBackgroundColorRedToGreen(cell);
                }
            },
            {
                text: rank.toString(),
                func: (cell: JQuery): void => {
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

    private createVetoTableRow(movie: SelectableMovie): JQuery {
        const tableRow = createTableRow([
            {
                text: movie.title,
                func: (cell: JQuery): void => {
                    setAsMovieDetailsLink(cell, movie.id);
                }
            },
            { text: movie.year },
            { text: getTimeStringFromRuntime(movie.runtime) },
            { text: movie.genre },
            { text: movie.plot },
            {
                text: movie.rating,
                func: (cell: JQuery): void => {
                    setBackgroundColorRedToGreen(cell);
                }
            },
            {
                func: (cell: JQuery): void => {
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

    private handleVotesChanged(newVotes: Map<string, Map<number, number>>): void {
        newVotes.forEach((value, key) => {
            const votesCell = this.voteView.find(`td[votes-for=${key}]`);
            const totalVotes = sumVotes(value);
            const fadeMilliseconds = 150;

            votesCell.fadeOut(fadeMilliseconds, () => {
                votesCell.text(totalVotes).fadeIn(fadeMilliseconds);
            });
        });
    }

    private handleMovieRemoved(removedMovieId: string): void {
        const movieRow = this.voteView.find(`tr[movie-id=${removedMovieId}]`);
        movieRow.fadeOut(this.animTime * 3, () => {
            movieRow.hide();
        });

        const removedMovie = this.movies.find((movie) => movie.id === removedMovieId)!;
        removedMovie.removed = true;
    }

    private setupMultiVoteView(): void {
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

        console.log(this.movies);

        this.movies.forEach((movie) => {
            const tableRow = this.createMultiVoteTableRow(movie);
            voteTableBody.append(tableRow);
        });

        if (this.liveVoting) {
            this.addSocketListener('votes_changed', (newVotes) => {
                this.handleVotesChanged(newVotes);
            });
        } else {
            voteTableBody.parent().addClass('not-live');
        }

        const lockInButton = $('#lockInButton')
            .click(() => {
                const disabled = lockInButton.is('.active');
                lockInButton.blur();
                $('.vote-button').prop('disabled', disabled);
            });

        if (this.isHost && this.isExactPhase) {
            const closeVotingButton = $('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).show(this.animTime);
        }
    }

    private setupRandomView(): void {
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

        this.addSocketListener('movie_removed', (movie) => {
            this.handleMovieRemoved(movie);
        });

        if (this.isHost && this.isExactPhase) {
            const nextButton = $('#nextButton');

            this.addDOMListener(nextButton, 'click', () => {
                let numRemainingMovies = 0;

                this.movies.forEach((movie) => {
                    if (movie.removed) {
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

    private setupRankedView(): void {
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

        const initialVoteDeltas = new Map<string, number>();

        this.movies.sort((movieA, movieB) => (movieB.votes.get(this.userToken) ?? 0) - (movieA.votes.get(this.userToken) ?? 0));

        this.movies.forEach((movie) => {
            const userVotes = movie.votes.get(this.userToken);

            if (userVotes == null || userVotes === 0) {
                initialVoteDeltas.set(movie.id, this.movies.length - rank + 1);
            }

            const tableRow = this.createRankedTableRow(movie, rank);
            voteTableBody.append(tableRow);

            rank += 1;
        });

        if (initialVoteDeltas.size !== 0) {
            this.socket.emit('votes_changed', initialVoteDeltas);
        }

        voteTableBody.sortable({
            update: () => {
                const rankCells = voteTableBody.find('.rank-cell');

                const changedVoteDeltas = new Map<string, number>();

                for (let i = 0; i < rankCells.length; i++) {
                    const rankCell = $(rankCells[i]);
                    const currentRank = Number.parseInt(rankCell.text(), 10);
                    const newRank = i + 1;

                    if (newRank !== currentRank) {
                        const movieId = rankCell.data('movie-id') as string;
                        changedVoteDeltas.set(movieId, currentRank - newRank);
                        rankCell.text(newRank);
                    }
                }

                if (changedVoteDeltas.size !== 0) {
                    this.socket.emit('votes_changed', changedVoteDeltas);
                }
            }
        });

        const lockInButton = $('#lockInButton')
            .click(() => {
                const disabled = lockInButton.is('.active');
                lockInButton.blur();
                voteTableBody.sortable(disabled ? 'disable' : 'enable');
                voteTableBody.toggleClass('rank-sortable');
            });

        if (this.isHost && this.isExactPhase) {
            const closeVotingButton = $('#closeVotingButton');

            this.addDOMListener(closeVotingButton, 'click', () => {
                this.socket.emit('close_voting');
            }).show(this.animTime);
        }
    }

    private setupVetoView(): void {
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
                if (movie.removed) {
                    numRemainingMovies += 1;
                }
            });

            if (numRemainingMovies <= this.numUsers) {
                this.socket.emit('close_voting');
            }
        });

        this.addSocketListener('get_chosen_user', (user: User) => {
            const enableButtons = this.isExactPhase && this.userToken === user.token;

            $('.veto-button').prop('disabled', !enableButtons);
            vetoUserText.text(user.username);
        });

        this.socket.emit('get_chosen_user');
    }
}