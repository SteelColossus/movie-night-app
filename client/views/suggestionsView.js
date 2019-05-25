import { View } from './view.js';
import { createTableRow, getTimeStringFromRuntime, setBackgroundColorRedToGreen, setAsMovieDetailsLink } from './viewFunctions.js';

export class SuggestionsView extends View {
    constructor(socket, animTime, userToken, isHost, movies, isExactPhase) {
        super(SuggestionsView.viewName, socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
        this.isExactPhase = isExactPhase;
        this.movieTableBody = $('#movieTable > tbody');
        this.closeSuggestionsButton = $('#closeSuggestionsButton');
    }

    appendMovieToTable(movie) {
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
            { text: movie.awards }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        tableRow.attr('movie-id', movie.id);

        this.movieTableBody.append(tableRow);

        return tableRow;
    }

    buildSuggestionsTable(movies) {
        movies.forEach((movie) => this.appendMovieToTable(movie));
    }

    handleNewMovie(movie) {
        const movieRow = this.appendMovieToTable(movie);
        movieRow.hide().show(this.animTime);
    }

    handleRemovedMovie(movieId) {
        const movieRow = this.movieTableBody.find(`tr[movie-id="${movieId}"]`);
        movieRow.remove();
    }

    onViewShown() {
        this.buildSuggestionsTable(this.movies);

        this.addSocketListener('new_movie', this.handleNewMovie);
        this.addSocketListener('removed_movie', this.handleRemovedMovie);

        if (this.isHost === true && this.isExactPhase === true) {
            this.addDOMListener(this.closeSuggestionsButton, 'click', () => {
                this.socket.emit('close_suggestions');
            }).show(this.animTime);
        }
    }

    onViewHidden() {
        this.closeSuggestionsButton.hide();
        // Remove all the existing movies
        this.movieTableBody.empty();
    }
}

SuggestionsView.viewName = 'suggestions';