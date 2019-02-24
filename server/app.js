const os = require('os');
const path = require('path');
const express = require('express');
const favicon = require('serve-favicon');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const args = require('minimist')(process.argv.slice(2));
const keys = require('./api_keys');
const constants = require('./constants');

// Allow people on the same network to access the app (this will use a different hostname)
const allowOutsideConnections = args.o === true;

const hostname = (allowOutsideConnections ? os.hostname() : 'localhost');
const port = 3000;

let phase = constants.PHASES.HOST;
let host = null;

const users = {};
const nightInfo = {};

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));
app.use(favicon(path.join(__dirname, '../client/favicon.ico')));
// Serve the constants file
app.get('/constants.js', (req, res) => res.sendFile(path.join(__dirname, 'constants.js')));

// Tell the server to listen on the given hostname and port
http.listen(port, hostname, console.log(`Listening at http://${hostname}:${port}.`));

function makeOmdbRequest(type, query) {
    return axios.get(`http://www.omdbapi.com/?${type}=${query}&apikey=${keys.OMDB_KEY}&type=movie`);
}

function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

function setWinner() {
    if (nightInfo.winner != null) {
        return;
    }

    const movieResults = nightInfo.movies.map(movie => ({
        "title": movie.title,
        "votes": sumVotes(movie.votes)
    }));

    const highestVotes = movieResults.reduce((max, movie) => (movie.votes > max ? movie.votes : max), 0);

    if (highestVotes > 0) {
        const winners = movieResults.filter(movie => movie.votes === highestVotes);

        // Pick a random winner - this is only temporary until something more visual gets added
        nightInfo.winner = winners[Math.floor(Math.random() * winners.length)];
    }
}

function isLoggedIn(socket) {
    return socket.token != null && users[socket.token] != null;
}

// Perform some checks before proceeding with a socket request
function preCheck(socket, requiredPhase, requireHost) {
    return isLoggedIn(socket) && phase === requiredPhase && (!requireHost || host === socket.token);
}

function switchPhase(socket, phaseName, sendToAll = true) {
    // Get the clients in the movie night room if they aren't already
    if (nightInfo.name != null) {
        if (sendToAll === true) {
            Object.values(io.sockets.connected).forEach((sock) => {
                if (sock.token != null) {
                    sock.join(nightInfo.name);
                }
            });
        }
        else if (sendToAll === false) {
            socket.join(nightInfo.name);
        }
    }

    let data = null;

    switch (phaseName) {
        case constants.PHASES.HOST:
            data = {
                "votingSystems": Object.values(constants.VOTING_SYSTEMS)
            };
            break;
        case constants.PHASES.SUGGEST:
            data = {
                "name": nightInfo.name,
                "votingSystem": nightInfo.votingSystem
            };
            break;
        case constants.PHASES.VOTE:
            data = nightInfo;
            break;
        case constants.PHASES.RESULTS:
            data = nightInfo;
            break;
        default:
            console.error(`Invalid phase '${phaseName}'.`);
            return;
    }

    const phaseInfo = {
        "name": phaseName,
        "data": data
    };

    if (host != null) {
        phaseInfo.isHost = (host === socket.token);
    }

    if (isLoggedIn(socket) && users[socket.token].username != null) {
        phaseInfo.username = users[socket.token].username;
    }

    phase = phaseName;

    socket.emit('new_phase', phaseInfo);

    if (sendToAll === true) {
        if (host != null) {
            phaseInfo.isHost = false;
        }

        delete phaseInfo.username;

        socket.broadcast.to(nightInfo.name).emit('new_phase', phaseInfo);
    }
    else if (sendToAll === false) {
        // If we're at the suggest phase and the user has already suggested a movie, send them back the movie suggestions
        if (phase === constants.PHASES.SUGGEST && nightInfo.movies.some(m => m.suggester === socket.token)) {
            const setupInfo = {
                "movies": nightInfo.movies
            };

            if (host != null) {
                setupInfo.isHost = (host === socket.token);
            }

            socket.emit('movie_suggestions', setupInfo);
        }
    }
}

function addUser(socket, token, username = null) {
    const isExistingUser = users.hasOwnProperty(token);

    if (isExistingUser || username != null) {
        if (username != null) {
            let usernameExists = Object.keys(users).some(userToken => userToken !== token.toString() && users[userToken].username === username);

            if (usernameExists === true) {
                socket.emit('request_new_username');
                return;
            }

            users[token] = {
                "username": username
            };
        }

        socket.token = token;

        console.log(`${isExistingUser ? 'Existing' : 'New'} user '${users[token].username}' connected.`);

        // Get newcomers to the same phase as everyone else
        switchPhase(socket, phase, false);
    }
    else {
        socket.emit('request_new_user');
    }
}

io.on('connection', (socket) => {
    // Ask for the user's token so we can authenticate them
    socket.emit('request_user_token');

    socket.on('user_token', (token) => {
        addUser(socket, token);
    });

    socket.on('new_user', (user) => {
        addUser(socket, user.token, user.username);
    });

    // Host a new movie night
    socket.on('host_night', (info) => {
        if (!preCheck(socket, constants.PHASES.HOST, false)) return;

        nightInfo.movies = [];
        nightInfo.name = info.name;
        nightInfo.votingSystem = info.votingSystem;
        host = socket.token;

        console.log(`${users[socket.token].username} has started the movie night: '${nightInfo.name}'`);
        switchPhase(socket, constants.PHASES.SUGGEST);
    });

    // When a movie is searched for, check the API for results
    socket.on('movie_search', (suggestion) => {
        if (!preCheck(socket, constants.PHASES.SUGGEST, false)) return;

        // Need to encode the URL for the API key to understand it
        let encodedSuggestion = encodeURIComponent(suggestion);

        /*
         * Weird syntax - create a promise that will eventually resolve with either a list of results or an error message.
         * This is needed because we can either get the results immediately or need to make another request which is done asynchronously.
         * When we get the results we send them back to the user.
         */
        const movieResultsPromise = new Promise((resolve) => {
            makeOmdbRequest('s', encodedSuggestion).then((response) => {
                let movieResults = {
                    "success": response.data.Response === 'True'
                };

                let movieMapFunction = result => ({
                    "id": result.imdbID,
                    "title": result.Title,
                    "year": result.Year
                });

                if (movieResults.success === true) {
                    movieResults.results = response.data.Search.map(movieMapFunction);

                    resolve(movieResults);
                }
                else if (response.data.Error === 'Too many results.') {
                    // If the API says we get too many results, then instead try to search by the exact title
                    makeOmdbRequest('t', encodedSuggestion).then((response2) => {
                        movieResults.success = response2.data.Response === 'True';

                        if (movieResults.success === true) {
                            movieResults.results = [movieMapFunction(response2.data)];
                        }
                        else if (movieResults.success === false) {
                            movieResults.errorMessage = response.data.Error + ' ' + response2.data.Error;
                        }

                        resolve(movieResults);
                    });
                }
                else {
                    movieResults.errorMessage = response.data.Error;

                    resolve(movieResults);
                }
            });
        });

        movieResultsPromise.then(movieResults => socket.emit('movie_search_results', movieResults));
    });

    socket.on('movie_chosen', (movieId) => {
        if (!preCheck(socket, constants.PHASES.SUGGEST, false)) return;

        // Disallow multiple people from choosing the same movie
        if (nightInfo.movies.some(x => x.id === movieId)) {
            socket.emit('request_different_movie', 'Someone else has already chosen that movie.');
            return;
        }

        // Get more information for the chosen movie
        makeOmdbRequest('i', movieId).then((response) => {
            let result = response.data;
            let movie = {
                "id": result.imdbID,
                "title": result.Title,
                "year": result.Year,
                "runtime": result.Runtime,
                "genre": result.Genre,
                "plot": result.Plot,
                "rating": result.imdbRating,
                "awards": result.Awards,
                "suggester": socket.token,
                "votes": {}
            };

            const bannedGenres = ['Short', 'Documentary'];
            const movieGenres = movie.genre.split(', ');

            const sharedGenres = bannedGenres.filter(genre => movieGenres.includes(genre));

            // Disallow anyone from choosing a movie that is one of the banned genres
            if (sharedGenres.length > 0) {
                socket.emit('request_different_movie', `The movie you have picked is one of the banned genres: ${sharedGenres.join(', ')}.`);
                return;
            }

            const missing = 'N/A';
            const missingInfo = [];

            if (movie.year === missing) missingInfo.push('Year');
            if (movie.runtime === missing) missingInfo.push('Runtime');
            if (movie.genre === missing) missingInfo.push('Genre');
            if (movie.plot === missing) missingInfo.push('Plot');
            if (movie.rating === missing) missingInfo.push('Rating');

            // Disallow movies which have key pieces of information missing (likely obscure movies that no-one really wants to watch)
            if (missingInfo.length > 0) {
                socket.emit('request_different_movie', `The movie you have picked is missing the following key information: ${missingInfo.join(', ')}.`);
                return;
            }

            nightInfo.movies.push(movie);

            const setupInfo = {
                "movies": nightInfo.movies
            };

            if (host != null) {
                setupInfo.isHost = (host === socket.token);
            }

            socket.emit('movie_suggestions', setupInfo);
            socket.broadcast.to(nightInfo.name).emit('new_movie', movie);
        });
    });

    socket.on('votes_changed', (voteDeltas) => {
        if (!preCheck(socket, constants.PHASES.VOTE, false)) return;

        const newVotes = {};

        Object.keys(voteDeltas).forEach((key) => {
            const value = voteDeltas[key];
            const movie = nightInfo.movies.find(x => x.id === key);

            if (movie != null) {
                if (movie.votes.hasOwnProperty(socket.token)) {
                    movie.votes[socket.token] += value;
                }
                else {
                    movie.votes[socket.token] = value;
                }
                if (movie.votes[socket.token] < 0) {
                    // Prevent a movie from having less than 0 votes
                    movie.votes[socket.token] = 0;
                }
                newVotes[key] = movie.votes;
            }
        });

        io.to(nightInfo.name).emit('votes_changed', newVotes);
    });

    socket.on('close_suggestions', () => {
        if (!preCheck(socket, constants.PHASES.SUGGEST, true)) return;

        switchPhase(socket, constants.PHASES.VOTE);
    });

    socket.on('close_voting', () => {
        if (!preCheck(socket, constants.PHASES.VOTE, true)) return;

        setWinner();

        switchPhase(socket, constants.PHASES.RESULTS);
    });

    socket.on('end_night', () => {
        if (!preCheck(socket, constants.PHASES.RESULTS, true)) return;

        nightInfo.movies = [];
        nightInfo.votingSystem = null;
        nightInfo.winner = null;
        host = null;

        switchPhase(socket, constants.PHASES.HOST);
        
        // The name has to be reset after switching the phase as it is used as the socket room name
        nightInfo.name = null;
    });

    socket.on('new_round', () => {
        if (!preCheck(socket, constants.PHASES.RESULTS, true)) return;

        nightInfo.movies = [];
        nightInfo.winner = null;

        switchPhase(socket, constants.PHASES.SUGGEST);
    });

    socket.on('disconnect', () => {
        if (socket.token != null) {
            const userToRemove = users[socket.token];
            console.log(`User '${userToRemove.username}' disconnected.`);
        }
    });
});