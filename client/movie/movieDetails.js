import { getTimeStringFromRuntime } from '../views/viewFunctions.js';

const queryParams = new URLSearchParams(location.search);
const movieId = queryParams.get('id');

fetch(`../movieDetails/${movieId}`, {
    method: 'GET',
    headers: {
        "Accept": "application/json"
    }
})
    .then((res) => {
        if (!res.ok) {
            res.json().then((err) => {
                alert(err); // eslint-disable-line no-alert
            });
        }
        else {
            res.json().then((movie) => {
                const title = `${movie.title} (${movie.year})`;

                document.title = `${title} - Movie Night App`;

                const movieTitle = document.getElementById('movieTitle');
                movieTitle.textContent = title;
                movieTitle.addEventListener('click', () => {
                    window.open(`https://www.imdb.com/title/${movieId}/`);
                });

                document.getElementById('moviePlot').textContent = movie.plot;
                document.getElementById('movieGenre').textContent = movie.genre;
                document.getElementById('movieRuntime').textContent = getTimeStringFromRuntime(movie.runtime);
                document.getElementById('movieActors').textContent = movie.actors;
                document.getElementById('movieDirector').textContent = movie.director;
                document.getElementById('movieWriter').textContent = movie.writer;
                if (movie.awards !== 'N/A') document.getElementById('movieAwards').textContent = movie.awards;
                document.getElementById('movieImdbRating').textContent = movie.rating;

                const posterImage = document.getElementById('posterImage');
                posterImage.setAttribute('src', movie.poster);
                posterImage.setAttribute('alt', `${movie.title} Poster`);

                document.getElementById('movieContainer').style.display = null;
            });
        }
    });