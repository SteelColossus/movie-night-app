import { View } from './view.js';
import { appendTableRow } from './viewFunctions.js';

export class SuggestionsView extends View {
    constructor(socket, animTime) {
        super('suggestions', animTime);
        this.socket = socket;
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

    onViewShown() {
        this.buildSuggestionsTable(this.movies);

        this.socket.on('new_movie', (movie) => {
            const movieRow = this.appendMovieToTable(movie);
            movieRow.hide().show(this.animTime);
        });

        if (this.isHost === true) {
            this.closeSuggestionsButton.show(this.animTime).click(() => {
                this.socket.emit('close_suggestions');
            });
        }
    }

    onViewHidden() {
        this.closeSuggestionsButton.hide();
        // Remove all the existing movies
        this.movieTable.find('tr:not(:first-child)').remove();
    }
}