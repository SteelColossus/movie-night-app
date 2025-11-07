import { getTimeStringFromRuntime } from '../views/viewFunctions.js';

function truncateText(text, length) {
    const ellipsis = '...';
    let truncatedText = text;
    const maxTextLength = length - ellipsis.length;

    if (text.length > maxTextLength) {
        let lastSpaceIndex = maxTextLength;

        while (lastSpaceIndex >= 0 && text[lastSpaceIndex] !== ' ') {
            lastSpaceIndex -= 1;
        }

        if (lastSpaceIndex < 0) {
            lastSpaceIndex = maxTextLength;
        }

        truncatedText = text.substring(0, lastSpaceIndex) + ellipsis;
    }

    return truncatedText;
}

const queryParams = new URLSearchParams(location.search);
const movieId = queryParams.get('id');

if (localStorage.getItem('darkMode') === true.toString()) {
    document.body.classList.add('dark-mode');
}

fetch(`../movieDetails/${movieId}`, {
    method: 'GET',
    headers: {
        Accept: 'application/json'
    }
}).then((res) => {
    if (!res.ok) {
        res.json().then((err) => {
            alert(err); // eslint-disable-line no-alert
        });
    } else {
        res.json().then((movie) => {
            const title = `${movie.title} (${movie.year})`;

            document.title = `${title} - Movie Night App`;

            const movieTitle = document.getElementById('movieTitle');
            movieTitle.textContent = title;
            movieTitle.addEventListener('click', () => {
                window.open(`https://www.imdb.com/title/${movieId}/`);
            });

            document.getElementById('moviePlot').textContent = truncateText(movie.plot, 500);
            document.getElementById('movieGenre').textContent = movie.genre;

            const bannedGenres = ['Short', 'Documentary'];

            if (bannedGenres.some((genre) => movie.genre.includes(genre))) {
                document.getElementById('bannedGenreText').style.removeProperty('display');
            }

            document.getElementById('movieRuntime').textContent = getTimeStringFromRuntime(
                movie.runtime
            );
            document.getElementById('movieActors').textContent = movie.actors;
            document.getElementById('movieDirector').textContent = movie.director;
            document.getElementById('movieWriter').textContent = movie.writer;
            if (movie.awards !== 'N/A') {
                document.getElementById('movieAwards').textContent = movie.awards;
            }
            document.getElementById('movieImdbRating').textContent = movie.rating;

            const posterImage = document.getElementById('posterImage');
            posterImage.setAttribute('src', movie.poster);
            posterImage.setAttribute('alt', `${movie.title} Poster`);

            document.getElementById('movieContainer').style.removeProperty('display');
        });
    }
});
