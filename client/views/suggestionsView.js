import { View } from './view.js';
import { appendTableRow } from './viewFunctions.js';

export class SuggestionsView extends View {
    constructor(socket, animTime, userToken, isHost, movies) {
        super('suggestions', socket, animTime);
        this.userToken = userToken;
        this.isHost = isHost;
        this.movies = movies;
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
            { "text": movie.rating },
            { "text": movie.awards }
        ]);

        if (movie.suggester === this.userToken) {
            tableRow.addClass('suggester-row');
        }

        return tableRow;
    }

    buildSuggestionsTable(movies) {
        movies.forEach(movie => this.appendMovieToTable(movie));
    }

    handleNewMovie(movie) {
        const movieRow = this.appendMovieToTable(movie);
        movieRow.hide().show(this.animTime);
    }

    onViewShown() {
        this.buildSuggestionsTable(this.movies);

        this.addSocketListener('new_movie', this.handleNewMovie);

        if (this.isHost === true) {
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