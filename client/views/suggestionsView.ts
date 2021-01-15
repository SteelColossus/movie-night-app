import type { Socket } from 'socket.io';

import type { SelectableMovie } from '../../server/common.js';

import { View } from './view.js';
import { createTableRow, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink, pluralize } from './viewFunctions.js';

export class SuggestionsView extends View {
    public static readonly viewName = 'suggestions';

    private readonly userToken: number;

    private readonly isHost: boolean;

    private readonly movies: SelectableMovie[];

    private readonly isExactPhase: boolean;

    private readonly movieTableBody: JQuery;

    private readonly numMoviesSuggestedLabel: JQuery;

    private readonly closeSuggestionsButton: JQuery;

    private numMoviesSuggested: number;

    public constructor(socket: Socket, animTime: number, userToken: number, isHost: boolean, movies: SelectableMovie[], isExactPhase: boolean) {
        super(SuggestionsView.viewName, socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
        this.isExactPhase = isExactPhase;
        this.movieTableBody = $('#movieTable > tbody');
        this.numMoviesSuggestedLabel = $('#numMoviesSuggested');
        this.closeSuggestionsButton = $('#closeSuggestionsButton');
        this.numMoviesSuggested = 0;
    }

    protected onViewShown(): void {
        this.buildSuggestionsTable(this.movies);

        this.addDOMListener($('#backToSearchButton'), 'click', () => {
            // Slight hack here, just set the hash instead of going through the proper internal function to navigate to the search page
            window.location.hash = 'search';
        });

        this.addSocketListener('new_movie', (movie) => {
            this.handleNewMovie(movie);
        });
        this.addSocketListener('removed_movie', (movieId) => {
            this.handleRemovedMovie(movieId);
        });

        this.updateNumMoviesSuggested(this.movies.length);

        if (this.isHost && this.isExactPhase) {
            this.addDOMListener(this.closeSuggestionsButton, 'click', () => {
                this.socket.emit('close_suggestions');
            }).show(this.animTime);
        }
    }

    protected onViewHidden(): void {
        this.closeSuggestionsButton.hide();
        // Remove all the existing movies
        this.movieTableBody.empty();
    }

    private appendMovieToTable(movie: SelectableMovie): JQuery {
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
            { text: movie.awards }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        tableRow.attr('movie-id', movie.id);

        this.movieTableBody.append(tableRow);

        return tableRow;
    }

    private buildSuggestionsTable(movies: SelectableMovie[]): void {
        movies.forEach((movie) => this.appendMovieToTable(movie));
    }

    private updateNumMoviesSuggested(numSuggested: number): void {
        this.numMoviesSuggested = numSuggested;
        this.numMoviesSuggestedLabel.text(`${pluralize('movie', this.numMoviesSuggested)} suggested.`);
    }

    private handleNewMovie(movie: SelectableMovie): void {
        const movieRow = this.appendMovieToTable(movie);
        movieRow.hide().show(this.animTime);
        this.updateNumMoviesSuggested(this.numMoviesSuggested + 1);
    }

    private handleRemovedMovie(movieId: string): void {
        const movieRow = this.movieTableBody.find(`tr[movie-id="${movieId}"]`);
        movieRow.remove();
        this.updateNumMoviesSuggested(this.numMoviesSuggested - 1);
    }
}