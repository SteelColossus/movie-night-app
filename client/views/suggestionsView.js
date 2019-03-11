import { View } from './view.js';
import { appendTableRow, setBackgroundColorRedToGreen } from './viewFunctions.js';

export class SuggestionsView extends View {
    constructor(socket, animTime, userToken, isHost, movies, isExactPhase) {
        super(SuggestionsView.viewName, socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
        this.isExactPhase = isExactPhase;
        this.movieTable = $('#movieTable');
        this.closeSuggestionsButton = $('#closeSuggestionsButton');
    }

    appendMovieToTable(movie) {
        const tableRow = appendTableRow(this.movieTable, [
            { "text": movie.title },
            { "text": movie.year },
            { "text": movie.runtime },
            { "text": movie.genre },
            { "text": movie.plot },
            { "text": movie.rating, "func": cell => setBackgroundColorRedToGreen(cell) },
            { "text": movie.awards }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        tableRow.attr('movie-id', movie.id);

        return tableRow;
    }

    buildSuggestionsTable(movies) {
        movies.forEach(movie => this.appendMovieToTable(movie));
    }

    handleNewMovie(movie) {
        const movieRow = this.appendMovieToTable(movie);
        movieRow.hide().show(this.animTime);
    }

    handleRemovedMovie(movieId) {
        const movieRow = this.movieTable.find(`tr[movie-id="${movieId}"]`);
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
        this.movieTable.find('tr:not(:first-child)').remove();
    }
}

SuggestionsView.viewName = 'suggestions';