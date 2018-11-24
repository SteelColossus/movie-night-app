const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const apikey = '315de77c';
const axios = require('axios');

const port = 3000;

const users = {};

const nightInfo = {
    "votingSystem": "multi-vote",
    "movies": []
};

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));

// Tell the server to listen on the given port
http.listen(port, console.log(`Listening on port ${port}.`));

function getRandomToken() {
    return Math.floor(Math.random() * 9999) + 1;
}

io.on('connection', (socket) => {
    const token = getRandomToken();
    socket.token = token;

    users[token] = {
        username: token,
        loggedIn: true
    };
    
    console.log(`User '${users[token].username}' connected.`);

    //When suggestion is added, check the api for results
    socket.on('suggest', (suggestion) => {
        //Need to split up words for the api key to understand it.
        let suggestionParts = suggestion.split(' ').join('+');
        axios.get('http://www.omdbapi.com/?s=' + suggestionParts + '&apikey=' + apikey)
            .then((response) => {
               socket.emit('print', response.data.Search);
            });
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
        io.emit('votes_changed', newVotes);
    });

    //Get information for the movie
    socket.on('chosen', (choice) => {
        let choiceParts = choice.split(' ').join('+');
        axios.get('http://www.omdbapi.com/?t=' + choiceParts + '&apikey=' + apikey)
            .then((response) => {
                let result = response.data;
                let movie = {
                    "title": result.Title,
                    "runtime": result.Runtime,
                    "genre": result.Genre,
                    "plot": result.Plot,
                    "rating": result.imdbRating,
                    "awards": result.Awards,
                    "votes": 0
                };
                nightInfo.movies.push(movie);
                socket.emit('setup', nightInfo);
            });
    });
    socket.on('disconnect', () => {
        const userToRemove = users[socket.token];
        users[socket.token].loggedIn = false;
        console.log(`User '${userToRemove.username}' disconnected.`);
    });
});