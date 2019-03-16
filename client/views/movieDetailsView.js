import { View } from './view.js';
import { getTimeStringFromRuntime } from './viewFunctions.js';

export class MovieDetailsView extends View {
    constructor(socket, animTime) {
        super(MovieDetailsView.viewName, socket, animTime);
        // Query params are provided as part of the hash
        const queryString = location.hash.substring(location.hash.indexOf('?'));
        const queryParams = new URLSearchParams(queryString);
        this.movieId = queryParams.get('id');
        this.imdbLink = `https://www.imdb.com/title/${this.movieId}/`;

        this.movieTitle = $('#movieTitle');
        this.posterImage = $('#posterImage');
        this.moviePlot = $('#moviePlot');
        this.movieGenre = $('#movieGenre');
        this.movieRuntime = $('#movieRuntime');
        this.movieActors = $('#movieActors');
        this.movieDirector = $('#movieDirector');
        this.movieWriter = $('#movieWriter');
        this.movieAwards = $('#movieAwards');
        this.movieImdbRating = $('#movieImdbRating');
        this.movieContainer = $('#movieContainer');
    }

    updateDetails(movie) {
        this.movieTitle.text(`${movie.title} (${movie.year})`)
            .addClass('subtle-link')
            .attr('title', 'Go to the IMDB page for this movie');

        this.addDOMListener(this.movieTitle, 'click', () => {
            window.open(this.imdbLink);
        });

        this.posterImage.attr('src', movie.poster)
            .attr('alt', `${movie.title} Poster`);

        this.moviePlot.text(movie.plot);
        this.movieGenre.text(movie.genre);
        this.movieRuntime.text(getTimeStringFromRuntime(movie.runtime));
        this.movieActors.text(movie.actors);
        this.movieDirector.text(movie.director);
        this.movieWriter.text(movie.writer);
        if (movie.awards !== 'N/A') this.movieAwards.text(movie.awards);
        this.movieImdbRating.text(movie.rating);

        this.movieContainer.show();
    }

    getHash() {
        return `#${this.viewName}?id=${this.movieId}`;
    }

    onViewShown() {
        this.movieContainer.hide();

        this.socket.emit('get_movie_details', this.movieId);

        this.addSocketListener('get_movie_details', this.updateDetails);
    }
}

MovieDetailsView.viewName = 'movie';