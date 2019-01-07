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

// Log when sockets connect and disconnect
const socketDebug = false;
// Allow people on the same network to access the app (this will use a different hostname)
const allowOutsideConnections = args.o === true;

const hostname = (allowOutsideConnections ? os.hostname() : 'localhost');
const port = 3000;

let phase = constants.HOST;
let host = null;

const users = {};

const nightInfo = {
    "movies": []
};

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

function switchPhase(socket, name, sendToAll = true) {
    // Server side validation to prevent non hosts from moving phases
    if (sendToAll === true && (!isLoggedIn(socket) || host !== socket.token)) return;

    // Get the clients in the movie night room if they aren't already
    if (nightInfo.name != null) {
        if (sendToAll === true) {
            Object.values(io.sockets.connected).forEach((sock) => {
                if (sock.token != null) {
                    sock.join(nightInfo.name);
                }
            });
        }
        else {
            socket.join(nightInfo.name);
        }
    }

    let data = null;

    switch (name) {
        case constants.HOST:
            data = {
                "votingSystems": constants.VOTING_SYSTEMS
            };
            break;
        case constants.SUGGEST:
            data = {
                "name": nightInfo.name,
                "votingSystem": nightInfo.votingSystem
            };
            break;
        case constants.VOTE:
            data = nightInfo;
            break;
        case constants.RESULTS:
            setWinner();
            data = nightInfo;
            break;
        default:
            console.error(`Invalid phase '${name}'.`);
            return;
    }

    phase = name;

    const phaseInfo = {
        "name": name,
        "data": data
    };

    if (host != null) {
        phaseInfo.isHost = (host === socket.token);
    }

    if (isLoggedIn(socket) && users[socket.token].username != null) {
        phaseInfo.username = users[socket.token].username;
    }

    socket.emit('new_phase', phaseInfo);

    if (sendToAll === true) {
        if (host != null) {
            phaseInfo.isHost = false;
        }

        delete phaseInfo.username;

        socket.broadcast.to(nightInfo.name).emit('new_phase', phaseInfo);
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

        // Get newcomers to the same point as everyone else
        switchPhase(socket, phase, false);

        if (phase === constants.SUGGEST && nightInfo.movies.some(m => m.suggester === token)) {
            const setupInfo = {
                "movies": nightInfo.movies
            };

            if (host != null) {
                setupInfo.isHost = (host === socket.token);
            }

            socket.emit('setup_movies', setupInfo);
        }
    }
    else {
        socket.emit('request_new_user');
    }
}

io.on('connection', (socket) => {
    if (socketDebug) {
        console.log(`Socket ${socket.id} connected.`);
    }

    socket.emit('request_user_token');

    socket.on('user_token', (token) => {
        addUser(socket, token);
    });

    socket.on('new_user', (user) => {
        addUser(socket, user.token, user.username);
    });

    // Setup basic movie night details
    socket.on('setup_details', (setupDetails) => {
        nightInfo.movies = [];
        nightInfo.name = setupDetails.name;
        nightInfo.votingSystem = setupDetails.votingSystem;
        nightInfo.winner = null;
        host = socket.token;
        console.log(`${users[socket.token].username} has started the movie night: '${nightInfo.name}'`);
        // Get every client in the room
        switchPhase(socket, constants.SUGGEST);
    });

    // When a movie is searched for, check the API for results
    socket.on('movie_search', (suggestion) => {
        if (!isLoggedIn(socket)) return;

        // Need to encode the URL for the API key to understand it
        let encodedSuggestion = encodeURIComponent(suggestion);

        new Promise(resolve => makeOmdbRequest('s', encodedSuggestion).then((response) => {
            let movieResults = {
                "success": response.data.Response === 'True'
            };

            let movieMapFunction = result => ({
                "id": result.imdbID,
                "title": result.Title,
                "year": result.Year
            });

            if (movieResults.success === true) {
                movieResults.results = response.data.Search.map(result => movieMapFunction(result));

                resolve(movieResults);
            }
            else if (response.data.Error === 'Too many results.') {
                makeOmdbRequest('t', encodedSuggestion).then((response2) => {
                    movieResults.success = response2.data.Response === 'True';

                    if (movieResults.success === true) {
                        movieResults.results = [movieMapFunction(response2.data)];
                    }
                    else {
                        movieResults.errorMessage = response.data.Error + ' ' + response2.data.Error;
                    }

                    resolve(movieResults);
                });
            }
            else {
                movieResults.errorMessage = response.data.Error;

                resolve(movieResults);
            }
        })).then(movieResults => socket.emit('movie_search', movieResults));
    });

    socket.on('close_suggestions', () => {
        switchPhase(socket, constants.VOTE);
    });

    socket.on('close_voting', () => {
        switchPhase(socket, constants.RESULTS);
    });

    socket.on('end', () => {
        switchPhase(socket, constants.HOST);
        host = null;
    });

    socket.on('new_round', () => {
        nightInfo.movies = [];
        nightInfo.winner = null;
        switchPhase(socket, constants.SUGGEST);
    });

    socket.on('votes_changed', (voteDeltas) => {
        if (!isLoggedIn(socket)) return;

        const newVotes = {};

        Object.keys(voteDeltas).forEach((key) => {
            const value = voteDeltas[key];
            const movie = nightInfo.movies.find(x => x.id == key);
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

    // Get information for the movie
    socket.on('movie_chosen', (movieId) => {
        if (!isLoggedIn(socket)) return;

        makeOmdbRequest('i', movieId).then((response) => {
            let result = response.data;
            let movie = {
                "success": result.Response,
                "id": result.imdbID,
                "title": result.Title,
                "year": result.Year,
                "runtime": result.Runtime,
                "genre": result.Genre,
                "plot": result.Plot,
                "rating": result.imdbRating,
                "awards": result.Awards,
                "votes": {},
                "suggester": socket.token
            };

            nightInfo.movies.push(movie);

            const setupInfo = {
                "movies": nightInfo.movies
            };

            if (host != null) {
                setupInfo.isHost = (host === socket.token);
            }

            socket.emit('setup_movies', setupInfo);
            socket.broadcast.to(nightInfo.name).emit('new_movie', movie);
        });
    });

    socket.on('disconnect', () => {
        if (socket.token != null) {
            const userToRemove = users[socket.token];
            console.log(`User '${userToRemove.username}' disconnected.`);
        }
        else if (socketDebug) {
            console.log(`Socket ${socket.id} disconnected.`);
        }
    });
});