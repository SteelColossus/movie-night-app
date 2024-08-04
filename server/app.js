import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import favicon from 'serve-favicon';
import sanitize from 'sanitize-filename';
import socketIO from 'socket.io';
import minimist from 'minimist';

import { OMDB_KEY } from './apiKeys.js';
import { PHASES, VOTING_SYSTEMS } from './constants.js';
import ObjectCache from './objectCache.js';

const app = express();
const server = createServer(app);
const io = socketIO(server, { cookie: false });
const args = minimist(process.argv.slice(2));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const verboseLogging = args.verbose === true;

// Allow people on the same network to access the app (this will use a different hostname)
const allowOutsideConnections = args.o === true;
// Whether a password is required to host a movie night
const requirePassword = args.password !== false;
// Whether the users get the votes for movies live in real time
const liveVoting = args.live === true;

const hostname = (allowOutsideConnections ? os.hostname() : null);
const port = process.env.PORT || 3000;

let password = null;

let phase = PHASES.HOST;
let host = null;

const users = {};
const nightInfo = {};

const nightHistory = [];

const usersToChooseFrom = [];
let chosenUserIndex = null;

const orderedPhases = [
    PHASES.HOST,
    PHASES.SUGGEST,
    PHASES.VOTE,
    PHASES.RESULTS
];

const movieDetailsCache = new ObjectCache(20, 'id');

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));
app.use(favicon(path.join(__dirname, '../client/favicon.ico')));
// Serve the constants file
app.use('/server/constants.js', express.static(path.join(__dirname, 'constants.js')));

// Tell the server to listen on the given hostname and port
if (hostname != null) {
    server.listen(port, hostname, () => { console.log(`Now listening on: http://${hostname}:${port}`) });
} else {
    server.listen(port, () => { console.log(`Now listening on: http://localhost:${port}`) });
}

function getRandomPassword() {
    const randomID = randomUUID();
    const randomPassword = randomID.substring(0, randomID.indexOf('-'));
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

    return fetch(`http://www.omdbapi.com/?${type}=${query}&apikey=${OMDB_KEY}&type=movie${additionalQueryString}`)
        .then(async (response) => {
            if (response.ok) {
                callback(await response.json());
            } else {
                console.error(response.status);
            }
        })
        .catch(console.error);
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
        case PHASES.HOST:
            data = {
                votingSystems: Object.values(VOTING_SYSTEMS),
                isPasswordRequired: password != null
            };
            break;
        case PHASES.SUGGEST:
            data = {
                name: nightInfo.name,
                movies: nightInfo.movies,
                suggestedMovies: getSuggestedMovies(token),
                maxSuggestions: nightInfo.maxSuggestions
            };
            break;
        case PHASES.VOTE:
            data = {
                name: nightInfo.name,
                movies: nightInfo.movies,
                votingSystem: nightInfo.votingSystem,
                numUsers: Object.keys(usersToChooseFrom).length,
                liveVoting
            };
            break;
        case PHASES.RESULTS:
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
            console.log(`Existing user '${previousUsername}' (${token}) changed their name to '${username}'.`);
        } else if (isExistingUser) {
            if (verboseLogging) {
                console.log(`Existing user '${users[token].username}' (${token}) reconnected.`);
            }
        } else {
            console.log(`New user '${users[token].username}' (${token}) connected.`);
        }

        socket.emit('user_info', users[token].username);

        // Get newcomers to the same phase as everyone else
        switchPhase(socket, phase, false);
    } else {
        socket.emit('request_new_user');
    }
}

function chooseNewUser() {
    chosenUserIndex = (chosenUserIndex + 1) % usersToChooseFrom.length;
}

function resetUserChooser() {
    usersToChooseFrom.length = 0;
    chosenUserIndex = null;
}

function dumpFile(filePath, fileOutput) {
    // Output all of the info to a file
    fs.writeFile(filePath, JSON.stringify(fileOutput), (err) => {
        if (!err) {
            console.log(`Dump file saved to ${filePath}.`);
        } else {
            console.error(err);
        }
    });
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

        if (!preCheck(socket.token, PHASES.HOST, nightAlreadyHosted)) {
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
        nightInfo.startDate = new Date();
        host = socket.token;

        if (nightAlreadyHosted) {
            console.log(`User '${users[socket.token].username}' has restarted the movie night under the new name: '${nightInfo.name}'.`);
        } else {
            console.log(`User '${users[socket.token].username}' has started the movie night: '${nightInfo.name}'.`);
        }

        switchPhase(socket, PHASES.SUGGEST);
    });

    // When a movie is searched for, check the API for results
    socket.on('movie_search', (suggestion) => {
        if (!preCheck(socket.token, PHASES.SUGGEST, false)) {
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
            makeOmdbRequest('s', encodedSuggestion, (responseJson) => {
                const movieResults = {
                    success: responseJson.Response === 'True'
                };

                function movieMapFunction(result) {
                    return {
                        id: result.imdbID,
                        title: result.Title,
                        year: result.Year
                    };
                }

                if (movieResults.success === true) {
                    movieResults.results = responseJson.Search.map(movieMapFunction);

                    resolve(movieResults);
                } else if (responseJson.Error === 'Too many results.') {
                    // If the API says we get too many results, then instead try to search by the exact title
                    makeOmdbRequest('t', encodedSuggestion, (responseJson2) => {
                        movieResults.success = responseJson2.Response === 'True';

                        if (movieResults.success === true) {
                            movieResults.results = [movieMapFunction(responseJson2)];
                        } else if (movieResults.success === false) {
                            movieResults.errorMessage = `${responseJson.Error} ${responseJson2.Error}`;
                        }

                        resolve(movieResults);
                    });
                } else {
                    movieResults.errorMessage = responseJson.Error;

                    resolve(movieResults);
                }
            });
        });

        movieResultsPromise.then((movieResults) => socket.emit('movie_search_results', movieResults));
    });

    socket.on('movie_chosen', (movieId) => {
        if (!preCheck(socket.token, PHASES.SUGGEST, false)) {
            return;
        }

        let suggestionsLeft = nightInfo.maxSuggestions - getSuggestedMovies(socket.token).length;

        // Disallow multiple people from choosing the same movie
        if (nightInfo.movies.some((x) => x.id === movieId && !(suggestionsLeft <= 0 && x.suggester === socket.token))) {
            socket.emit('request_different_movie', 'Someone has already chosen that movie.');
            return;
        }

        // Get more information for the chosen movie
        makeOmdbRequest('i', movieId, (responseJson) => {
            const movie = {
                id: responseJson.imdbID,
                title: responseJson.Title,
                year: responseJson.Year,
                runtime: responseJson.Runtime,
                genre: responseJson.Genre,
                plot: responseJson.Plot,
                rating: responseJson.imdbRating,
                awards: responseJson.Awards,
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
                if (usersToChooseFrom.findIndex((x) => x.token === socket.token) === -1) {
                    // Add user to the front of the array (as picking last is more advantageous)
                    usersToChooseFrom.unshift({
                        token: socket.token,
                        username: users[socket.token].username
                    });

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
        if (!preCheck(socket.token, PHASES.VOTE, false, true)) {
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
        if (!preCheck(socket.token, PHASES.VOTE, false, true)) {
            return;
        }

        const movieToRemove = nightInfo.movies.find((movie) => movie.id === id);

        if (movieToRemove != null) {
            movieToRemove.removed = true;

            io.to(nightInfo.name).emit('movie_removed', id);

            if (nightInfo.votingSystem === VOTING_SYSTEMS.VETO) {
                chooseNewUser();

                io.to(nightInfo.name).emit('get_chosen_user', usersToChooseFrom[chosenUserIndex]);

                console.log(`User '${users[socket.token].username}' has vetoed the movie: '${movieToRemove.title}' (${movieToRemove.id}).`);
            }
        }
    });

    socket.on('remove_random_movie', () => {
        if (!preCheck(socket.token, PHASES.VOTE, true, true)) {
            return;
        }

        const nonRemovedMovies = nightInfo.movies.filter((movie) => movie.removed === false);

        if (nonRemovedMovies.length > 1) {
            const randomMovie = nonRemovedMovies[Math.floor(Math.random() * nonRemovedMovies.length)];

            // Remove the chosen movie from the night
            randomMovie.removed = true;

            io.to(nightInfo.name).emit('movie_removed', randomMovie.id);

            console.log(`The movie '${randomMovie.title}' (${randomMovie.id}) has been removed.`);
        }
    });

    socket.on('close_suggestions', () => {
        if (!preCheck(socket.token, PHASES.SUGGEST, true, true)) {
            return;
        }

        switchPhase(socket, PHASES.VOTE);
    });

    socket.on('close_voting', () => {
        if (!preCheck(socket.token, PHASES.VOTE, true, true)) {
            return;
        }

        const winners = getWinners();

        console.log('Final results are:');
        nightInfo.movies.forEach((movie) => console.log(`'${movie.title}' (${movie.id}): ${movie.removed ? 'removed' : JSON.stringify(movie.votes)}`));

        if (winners.length > 1) {
            const newStageData = {
                movies: nightInfo.movies.filter((movie) => winners.includes(movie.id)),
                votingSystem: VOTING_SYSTEMS.RANDOM,
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

            switchPhase(socket, PHASES.RESULTS);
        }
    });

    socket.on('end_night', () => {
        if (!preCheck(socket.token, PHASES.RESULTS, true)) {
            return;
        }

        resetUserChooser();

        // Store a copy of the night info
        nightHistory.push({ ...nightInfo });

        if (args.c === true) {
            const fileOutput = {
                rounds: nightHistory.slice(),
                host,
                users
            };

            const sanitizedNightName = sanitize(nightInfo.name.replace(/ /gu, '_'));

            // Construct a filename by replacing spaces with dashes in the night name and assembling the current date
            const filename = `${sanitizedNightName}-${nightInfo.startDate.toISOString().split('.')[0].replace(/:/gu, ';')}.json`;
            const directory = 'logs';
            const filePath = `${directory}/${filename}`;

            fs.access(directory, (existErr) => {
                if (existErr) {
                    fs.mkdir(directory, (mkErr) => {
                        if (!mkErr) {
                            dumpFile(filePath, fileOutput);
                        } else {
                            console.error(mkErr);
                        }
                    });
                } else {
                    dumpFile(filePath, fileOutput);
                }
            });
        }

        nightHistory.length = 0;

        nightInfo.movies = [];
        nightInfo.votingSystem = null;
        nightInfo.winner = null;
        nightInfo.startDate = new Date();
        host = null;

        switchPhase(socket, PHASES.HOST);

        // The name has to be reset after switching the phase as it is used as the socket room name
        nightInfo.name = null;
    });

    socket.on('new_round', () => {
        if (!preCheck(socket.token, PHASES.RESULTS, true)) {
            return;
        }

        resetUserChooser();

        // Store a copy of the night info
        nightHistory.push({ ...nightInfo });

        nightInfo.movies = [];
        nightInfo.winner = null;

        switchPhase(socket, PHASES.SUGGEST);
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
            if (verboseLogging) {
                const userToRemove = users[socket.token];
                console.log(`User '${userToRemove.username}' (${socket.token}) disconnected.`);
            }
        }
    });
});

app.get('/movieDetails/:id', (req, res) => {
    const movieId = req.params.id;
    const cachedMovie = movieDetailsCache.get(movieId);

    if (cachedMovie == null) {
        makeOmdbRequest('i', movieId, (responseJson) => {
            if (responseJson.Response === 'True') {
                const movie = {
                    id: responseJson.imdbID,
                    title: responseJson.Title,
                    year: responseJson.Year,
                    runtime: responseJson.Runtime,
                    genre: responseJson.Genre,
                    plot: responseJson.Plot,
                    rating: responseJson.imdbRating,
                    awards: responseJson.Awards,
                    actors: responseJson.Actors,
                    director: responseJson.Director,
                    writer: responseJson.Writer,
                    poster: responseJson.Poster
                };

                movieDetailsCache.set(movie);
                res.json(movie);
            } else {
                res.status(404).json(responseJson.Error);
            }
        }, { plot: 'full' });
    } else {
        res.json(cachedMovie);
    }
});