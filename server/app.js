const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const keys = require('./api_keys');

const port = 3000;

let phase = 'host';

const users = {};

const nightInfo = {
    "movies": []
};

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));

// Tell the server to listen on the given port
http.listen(port, console.log(`Listening on port ${port}.`));

function getRandomToken() {
    return Math.floor(Math.random() * 9999) + 1;
}

function makeOmdbRequest(type, query) {
    return axios.get(`http://www.omdbapi.com/?${type}=${query}&apikey=${keys.OMDB_KEY}&type=movie`);
}

io.on('connection', (socket) => {
    const token = getRandomToken();
    socket.token = token;

    users[token] = {
        username: token,
        loggedIn: true
    };

    console.log(`User '${users[token].username}' connected.`);

    // Get newcomers to the same point as everyone else
    switch (phase) {
        case 'host':
            socket.emit('new_phase', {
                "name": "host",
                "data": null
            });
            break;
        case 'suggest':
            socket.emit('new_phase', {
                "name": "suggest",
                "data": {
                    "name": nightInfo.name,
                    "votingSystem": nightInfo.votingSystem
                }
            });
            break;
    }

    //Setup basic movie night details
    socket.on("setup_details", (setupDetails) => {
        nightInfo.name = setupDetails.name;
        nightInfo.votingSystem = setupDetails.votingSystem;
        phase = 'suggest';
        console.log(`${users[token].username} has started the movie night: '${nightInfo.name}'`);
        //Get every client in the room
        io.emit('new_phase', {
            "name": "suggest",
            "data": {
                "name": nightInfo.name,
                "votingSystem": nightInfo.votingSystem
            }
        });
    });

    //When a movie is searched for, check the api for results
    socket.on('movie_search', (suggestion) => {
        //Need to encode the URL for the api key to understand it.
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

    socket.on('votes_changed', (voteDeltas) => {
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

    //Get information for the movie
    socket.on('movie_chosen', (movieId) => {
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
                "votes": {}
            };

            nightInfo.movies.push(movie);
            socket.emit('setup', nightInfo);
            socket.broadcast.to(nightInfo.name).emit('new_movie', movie);
        });
    });

    socket.on('disconnect', () => {
        const userToRemove = users[socket.token];
        users[socket.token].loggedIn = false;
        console.log(`User '${userToRemove.username}' disconnected.`);
    });

    //Make the socket join the voting room
    socket.on('join_movie_night', (room) => {
        socket.join(room);
    });
});