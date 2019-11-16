'use strict';

const os = require('os');
const path = require('path');
const express = require('express');
const favicon = require('serve-favicon');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const args = require('minimist')(process.argv.slice(2));
const keys = require('./apiKeys');
const constants = require('./constants');
const ObjectCache = require('./objectCache');

// Allow people on the same network to access the app (this will use a different hostname)
const allowOutsideConnections = args.o === true;
// Whether a password is required to host a movie night
const requirePassword = args.password !== false;
// Whether the users get the votes for movies live in real time
const liveVoting = args.live === true;

const hostname = (allowOutsideConnections ? os.hostname() : 'localhost');
const port = 3000;

let password = null;

let phase = constants.PHASES.HOST;
let host = null;

const users = {};
const nightInfo = {};

const usersToChooseFrom = [];
let chosenUserIndex = null;
let chooseOrderIsForward = true;

const orderedPhases = [
    constants.PHASES.HOST,
    constants.PHASES.SUGGEST,
    constants.PHASES.VOTE,
    constants.PHASES.RESULTS
];

const movieDetailsCache = new ObjectCache(20, 'id');

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));
app.use(favicon(path.join(__dirname, '../client/favicon.ico')));
// Serve the constants file
app.get('/constants.js', (req, res) => res.sendFile(path.join(__dirname, 'constants.js')));

// Tell the server to listen on the given hostname and port
http.listen(port, hostname, console.log(`Now listening on: http://${hostname}:${port}`));

function getRandomPassword() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const passwordLength = 8;

    let randomPassword = '';

    for (let i = 0; i < passwordLength; i++) {
        const randomChar = chars[Math.floor(Math.random() * chars.length)];
        randomPassword += randomChar;
    }

    return randomPassword;
}

if (requirePassword === true) {
    password = getRandomPassword();
    console.log(`Password is required and has been set as '${password}'.`);
} else {
    console.log('Password is not required.');
}

function makeOmdbRequest(type, query, callback, data = {}) {
    let additionalQueryString = '';

    // Add a query param for each key value pair in data
    Object.entries(data).forEach((entry) => {
        additionalQueryString += `&${entry[0]}=${entry[1]}`;
    });

    return axios.get(`http://www.omdbapi.com/?${type}=${query}&apikey=${keys.OMDB_KEY}&type=movie${additionalQueryString}`)
        .then(callback)
        .catch(console.log);
}

function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

function getSuggestedMovies(token) {
    return Object.values(nightInfo.movies).filter((movie) => movie.suggester === token);
}

function getWinners() {
    if (nightInfo.winner != null) {
        return [nightInfo.winner];
    }

    // There are two ways you can be crowned the winning movie of a movie night - either by getting the most votes, or being the last one remaining.
    const nonRemovedMovies = nightInfo.movies.filter((movie) => movie.removed === false);

    if (nonRemovedMovies.length === 1) {
        // If there's only one movie remaining, the winner is the one remaining
        return [nonRemovedMovies[0].id];
    }

    const movieResults = nonRemovedMovies.map((movie) => ({
        id: movie.id,
        totalVotes: sumVotes(movie.votes)
    }));

    // Otherwise, we have to see which one has the most votes
    const highestVotes = movieResults.reduce((max, movie) => (movie.totalVotes > max ? movie.totalVotes : max), 0);

    if (highestVotes > 0 || nonRemovedMovies.length < nightInfo.movies.length) {
        const winners = movieResults.filter((movie) => movie.totalVotes === highestVotes);

        return winners.map((movie) => movie.id);
    }

    return [];
}

function isLoggedIn(token) {
    return token != null && users[token] != null;
}

function isCurrentPhaseBeforeOrSameAsPhase(requiredPhase) {
    return orderedPhases.indexOf(requiredPhase) <= orderedPhases.indexOf(phase);
}

// Perform some checks before proceeding with a socket request
function preCheck(token, requiredPhase, requireHost, requireExactPhase = false) {
    return isLoggedIn(token)
        && (requireExactPhase ? phase === requiredPhase : isCurrentPhaseBeforeOrSameAsPhase(requiredPhase))
        && (!requireHost || host === token);
}

function getPhaseData(phaseName, token) {
    let data = null;

    switch (phaseName) {
        case constants.PHASES.HOST:
            data = {
                votingSystems: Object.values(constants.VOTING_SYSTEMS),
                isPasswordRequired: password != null
            };
            break;
        case constants.PHASES.SUGGEST:
            data = {
                name: nightInfo.name,
                movies: nightInfo.movies,
                suggestedMovies: getSuggestedMovies(token),
                maxSuggestions: nightInfo.maxSuggestions
            };
            break;
        case constants.PHASES.VOTE:
            data = {
                name: nightInfo.name,
                movies: nightInfo.movies,
                votingSystem: nightInfo.votingSystem,
                numUsers: Object.keys(usersToChooseFrom).length,
                liveVoting
            };
            break;
        case constants.PHASES.RESULTS:
            data = {
                name: nightInfo.name,
                movies: nightInfo.movies,
                winner: nightInfo.winner,
                users
            };
            break;
        default:
            console.error(`Invalid phase '${phaseName}'.`);
            break;
    }

    return data;
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
        } else if (sendToAll === false) {
            socket.join(nightInfo.name);
        }
    }

    const phaseInfo = {
        name: phaseName,
        data: getPhaseData(phaseName, socket.token)
    };

    if (host != null) {
        phaseInfo.isHost = (host === socket.token);
    }

    phase = phaseName;

    socket.emit('new_phase', phaseInfo);

    if (sendToAll === true) {
        if (host != null) {
            phaseInfo.isHost = false;
        }

        socket.broadcast.to(nightInfo.name).emit('new_phase', phaseInfo);
    }
}

function addUser(socket, token, username = null) {
    const isExistingUser = users.hasOwnProperty(token);
    const newUsername = username != null;

    if (isExistingUser || newUsername) {
        let previousUsername = null;

        if (newUsername) {
            const usernameExists = Object.keys(users).some((userToken) => userToken !== token.toString() && users[userToken].username === username);

            if (usernameExists === true) {
                socket.emit('request_new_username');
                return;
            }

            if (isExistingUser) {
                previousUsername = users[token].username;
            }

            users[token] = {
                username
            };
        }

        socket.token = token;

        if (isExistingUser && newUsername) {
            console.log(`Existing user '${previousUsername}' changed their name to '${username}'.`);
        } else if (isExistingUser) {
            console.log(`Existing user '${users[token].username}' connected.`);
        } else {
            console.log(`New user '${users[token].username}' connected.`);
        }

        socket.emit('user_info', users[token].username);

        // Get newcomers to the same phase as everyone else
        switchPhase(socket, phase, false);
    } else {
        socket.emit('request_new_user');
    }
}

function chooseNewUser() {
    if (chooseOrderIsForward) {
        if (chosenUserIndex + 1 >= usersToChooseFrom.length - 1) {
            chooseOrderIsForward = false;
            chosenUserIndex = usersToChooseFrom.length - 1;
        } else {
            chosenUserIndex += 1;
        }
    } else if (chosenUserIndex - 1 <= 0) {
        chooseOrderIsForward = true;
        chosenUserIndex = 0;
    } else {
        chosenUserIndex -= 1;
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
        const nightAlreadyHosted = host != null;

        if (!preCheck(socket.token, constants.PHASES.HOST, nightAlreadyHosted)) {
            return;
        }

        if (password != null && (info.password == null || info.password.toLowerCase() !== password)) {
            socket.emit('wrong_password');
            return;
        }

        nightInfo.movies = [];
        nightInfo.name = info.name;
        nightInfo.votingSystem = info.votingSystem;
        nightInfo.maxSuggestions = parseInt(info.numSuggestions, 10);
        host = socket.token;

        if (nightAlreadyHosted) {
            console.log(`User '${users[socket.token].username}' has restarted the movie night under the new name: '${nightInfo.name}'.`);
        } else {
            console.log(`User '${users[socket.token].username}' has started the movie night: '${nightInfo.name}'.`);
        }

        switchPhase(socket, constants.PHASES.SUGGEST);
    });

    // When a movie is searched for, check the API for results
    socket.on('movie_search', (suggestion) => {
        if (!preCheck(socket.token, constants.PHASES.SUGGEST, false)) {
            return;
        }

        // Need to encode the URL for the API key to understand it
        const encodedSuggestion = encodeURIComponent(suggestion);

        /*
         * Weird syntax - create a promise that will eventually resolve with either a list of results or an error message.
         * This is needed because we can either get the results immediately or need to make another request which is done asynchronously.
         * When we get the results we send them back to the user.
         */
        const movieResultsPromise = new Promise((resolve) => {
            makeOmdbRequest('s', encodedSuggestion, (response) => {
                const movieResults = {
                    success: response.data.Response === 'True'
                };

                function movieMapFunction(result) {
                    return {
                        id: result.imdbID,
                        title: result.Title,
                        year: result.Year
                    };
                }

                if (movieResults.success === true) {
                    movieResults.results = response.data.Search.map(movieMapFunction);

                    resolve(movieResults);
                } else if (response.data.Error === 'Too many results.') {
                    // If the API says we get too many results, then instead try to search by the exact title
                    makeOmdbRequest('t', encodedSuggestion, (response2) => {
                        movieResults.success = response2.data.Response === 'True';

                        if (movieResults.success === true) {
                            movieResults.results = [movieMapFunction(response2.data)];
                        } else if (movieResults.success === false) {
                            movieResults.errorMessage = `${response.data.Error} ${response2.data.Error}`;
                        }

                        resolve(movieResults);
                    });
                } else {
                    movieResults.errorMessage = response.data.Error;

                    resolve(movieResults);
                }
            });
        });

        movieResultsPromise.then((movieResults) => socket.emit('movie_search_results', movieResults));
    });

    socket.on('movie_chosen', (movieId) => {
        if (!preCheck(socket.token, constants.PHASES.SUGGEST, false)) {
            return;
        }

        // Disallow multiple people from choosing the same movie
        if (nightInfo.movies.some((x) => x.id === movieId)) {
            socket.emit('request_different_movie', 'Someone has already chosen that movie.');
            return;
        }

        // Get more information for the chosen movie
        makeOmdbRequest('i', movieId, (response) => {
            const result = response.data;
            const movie = {
                id: result.imdbID,
                title: result.Title,
                year: result.Year,
                runtime: result.Runtime,
                genre: result.Genre,
                plot: result.Plot,
                rating: result.imdbRating,
                awards: result.Awards,
                suggester: socket.token,
                votes: {},
                removed: false
            };

            const bannedGenres = ['Short', 'Documentary'];
            const movieGenres = movie.genre.split(', ');

            const sharedGenres = bannedGenres.filter((genre) => movieGenres.includes(genre));

            // Disallow anyone from choosing a movie that is one of the banned genres
            if (sharedGenres.length > 0) {
                socket.emit('request_different_movie', `The movie you have picked is one of the banned genres: ${sharedGenres.join(', ')}.`);
                return;
            }

            const missing = 'N/A';
            const missingInfo = [];

            if (movie.year === missing) {
                missingInfo.push('Year');
            }
            if (movie.runtime === missing) {
                missingInfo.push('Runtime');
            }
            if (movie.genre === missing) {
                missingInfo.push('Genre');
            }
            if (movie.plot === missing) {
                missingInfo.push('Plot');
            }
            if (movie.rating === missing) {
                missingInfo.push('Rating');
            }

            // Disallow movies which have key pieces of information missing (likely obscure movies that no-one really wants to watch)
            if (missingInfo.length > 0) {
                socket.emit('request_different_movie', `The movie you have picked is missing the following key information: ${missingInfo.join(', ')}.`);
                return;
            }

            let suggestionsLeft = nightInfo.maxSuggestions - getSuggestedMovies(socket.token).length;

            if (suggestionsLeft <= 0) {
                // Remove all the previous movie suggestions this user has made
                for (let i = nightInfo.movies.length - 1; i >= 0; i--) {
                    if (nightInfo.movies[i].suggester === socket.token) {
                        socket.broadcast.to(nightInfo.name).emit('removed_movie', nightInfo.movies[i].id);
                        nightInfo.movies.splice(i, 1);
                    }
                }

                suggestionsLeft = nightInfo.maxSuggestions;
            }

            nightInfo.movies.push(movie);

            suggestionsLeft -= 1;

            const data = {
                movies: nightInfo.movies
            };

            if (host != null) {
                data.isHost = (host === socket.token);
            }

            console.log(`User '${users[socket.token].username}' has suggested the movie: '${movie.title}' (${movie.id}).`);

            if (suggestionsLeft <= 0) {
                if (!usersToChooseFrom.includes(socket.token)) {
                    usersToChooseFrom.push(socket.token);

                    if (chosenUserIndex == null) {
                        chosenUserIndex = 0;
                    }
                }

                socket.emit('movie_suggestions_done', data);
            } else {
                socket.emit('movie_suggestion_added', movie);
            }

            socket.broadcast.to(nightInfo.name).emit('new_movie', movie);
        });
    });

    socket.on('votes_changed', (voteDeltas) => {
        if (!preCheck(socket.token, constants.PHASES.VOTE, false, true)) {
            return;
        }

        const newVotes = {};

        Object.keys(voteDeltas).forEach((key) => {
            const value = voteDeltas[key];
            const movie = nightInfo.movies.find((x) => x.id === key);

            if (movie != null) {
                if (movie.votes.hasOwnProperty(socket.token)) {
                    movie.votes[socket.token] += value;
                } else {
                    movie.votes[socket.token] = value;
                }
                if (movie.votes[socket.token] < 0) {
                    // Prevent a movie from having less than 0 votes
                    movie.votes[socket.token] = 0;
                }
                newVotes[key] = movie.votes;
            }
        });

        if (liveVoting === true) {
            io.to(nightInfo.name).emit('votes_changed', newVotes);
        }
    });

    socket.on('remove_movie', (id) => {
        if (!preCheck(socket.token, constants.PHASES.VOTE, false, true)) {
            return;
        }

        const movieToRemove = nightInfo.movies.find((movie) => movie.id === id);

        if (movieToRemove != null) {
            movieToRemove.removed = true;

            io.to(nightInfo.name).emit('movie_removed', id);

            if (nightInfo.votingSystem === constants.VOTING_SYSTEMS.VETO) {
                chooseNewUser();

                io.to(nightInfo.name).emit('get_chosen_user', usersToChooseFrom[chosenUserIndex]);
            }
        }
    });

    socket.on('remove_random_movie', () => {
        if (!preCheck(socket.token, constants.PHASES.VOTE, true, true)) {
            return;
        }

        const nonRemovedMovies = nightInfo.movies.filter((movie) => movie.removed === false);

        if (nonRemovedMovies.length > 1) {
            const randomMovie = nonRemovedMovies[Math.floor(Math.random() * nonRemovedMovies.length)];

            // Remove the chosen movie from the night
            randomMovie.removed = true;

            io.to(nightInfo.name).emit('movie_removed', randomMovie.id);
        }
    });

    socket.on('close_suggestions', () => {
        if (!preCheck(socket.token, constants.PHASES.SUGGEST, true, true)) {
            return;
        }

        switchPhase(socket, constants.PHASES.VOTE);
    });

    socket.on('close_voting', () => {
        if (!preCheck(socket.token, constants.PHASES.VOTE, true, true)) {
            return;
        }

        const winners = getWinners();

        console.log('Final results are:');
        nightInfo.movies.forEach((movie) => console.log(`'${movie.title}' (${movie.id}): ${JSON.stringify(movie.votes)}`));

        if (winners.length > 1) {
            const newStageData = {
                movies: nightInfo.movies.filter((movie) => winners.includes(movie.id)),
                votingSystem: constants.VOTING_SYSTEMS.RANDOM,
                isHost: host === socket.token
            };

            // If there's multiple movies tied as winners, we need to go to the random voting stage to decide a winner
            socket.emit('new_voting_stage', newStageData);

            newStageData.isHost = false;

            socket.broadcast.emit('new_voting_stage', newStageData);
        } else {
            if (winners.length === 1) {
                nightInfo.winner = winners[0];
            }

            switchPhase(socket, constants.PHASES.RESULTS);
        }
    });

    socket.on('end_night', () => {
        if (!preCheck(socket.token, constants.PHASES.RESULTS, true)) {
            return;
        }

        nightInfo.movies = [];
        nightInfo.votingSystem = null;
        nightInfo.winner = null;
        host = null;

        switchPhase(socket, constants.PHASES.HOST);

        // The name has to be reset after switching the phase as it is used as the socket room name
        nightInfo.name = null;
    });

    socket.on('new_round', () => {
        if (!preCheck(socket.token, constants.PHASES.RESULTS, true)) {
            return;
        }

        nightInfo.movies = [];
        nightInfo.winner = null;

        switchPhase(socket, constants.PHASES.SUGGEST);
    });

    socket.on('get_phase_data', (phaseName) => {
        if (!preCheck(socket.token, phaseName, false)) {
            return;
        }

        const data = getPhaseData(phaseName, socket.token);

        if (host != null) {
            data.isHost = (host === socket.token);
        }

        data.isExactPhase = phase === phaseName;

        socket.emit('get_phase_data', data);
    });

    socket.on('get_chosen_user', () => {
        socket.emit('get_chosen_user', usersToChooseFrom[chosenUserIndex]);
    });

    socket.on('disconnect', () => {
        if (socket.token != null) {
            const userToRemove = users[socket.token];
            console.log(`User '${userToRemove.username}' disconnected.`);
        }
    });
});

app.get('/movieDetails/:id', (req, res) => {
    const movieId = req.params.id;
    const cachedMovie = movieDetailsCache.get(movieId);

    if (cachedMovie == null) {
        makeOmdbRequest('i', movieId, (response) => {
            if (response.data.Response === 'True') {
                const result = response.data;
                const movie = {
                    id: result.imdbID,
                    title: result.Title,
                    year: result.Year,
                    runtime: result.Runtime,
                    genre: result.Genre,
                    plot: result.Plot,
                    rating: result.imdbRating,
                    awards: result.Awards,
                    actors: result.Actors,
                    director: result.Director,
                    writer: result.Writer,
                    poster: result.Poster
                };

                movieDetailsCache.set(movie);
                res.json(movie);
            } else {
                res.status(404).json(response.data.Error);
            }
        }, { plot: 'full' });
    } else {
        res.json(cachedMovie);
    }
});