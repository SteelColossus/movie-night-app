import { View } from './view.js';
import { sumVotes, pluralize } from './viewFunctions.js';

export class ResultsView extends View {
    constructor(socket, animTime, isHost, movies, winner) {
        super(ResultsView.viewName, socket, animTime);
        this.isHost = isHost;
        this.movies = movies;
        this.winner = movies.find((movie) => movie.id === winner);
        this.canvas = $('#voteChart');
        this.endButton = $('#endButton');
        this.newMovieButton = $('#newMovieButton');
    }

    createChart(movies) {
        const labels = [];
        const votes = [];

        movies.forEach((movie) => {
            const numVotes = sumVotes(movie.votes);

            if (numVotes > 0) {
                labels.push(movie.title);
                votes.push(numVotes);
            }
        });

        if (votes.length > 0) {
            this.voteChart = new Chart(this.canvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: '# of Votes',
                            data: votes,
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.2)',
                                'rgba(54, 162, 235, 0.2)',
                                'rgba(255, 206, 86, 0.2)',
                                'rgba(75, 192, 192, 0.2)',
                                'rgba(153, 102, 255, 0.2)',
                                'rgba(255, 159, 64, 0.2)'
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(75, 192, 192, 1)',
                                'rgba(153, 102, 255, 1)',
                                'rgba(255, 159, 64, 1)'
                            ],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    maintainAspectRatio: false,
                    scales: {
                        yAxes: [
                            {
                                ticks: {
                                    beginAtZero: true
                                }
                            }
                        ]
                    }
                }
            });

            this.canvas.show();
        }
    }

    onViewShown() {
        let winnerText = 'No one voted for any movies!';
        let numRemainingMovies = 0;

        this.movies.forEach((movie) => {
            if (movie.removed === false) {
                numRemainingMovies += 1;
            }
        });

        // Show different text depending on the outcome
        if (this.winner != null) {
            if (numRemainingMovies === 1) {
                winnerText = `Winner is ${this.winner.title}!`;
            } else {
                const totalVotes = sumVotes(this.winner.votes);
                winnerText = `Winner is ${this.winner.title} with ${pluralize('vote', totalVotes)}!`;
            }
        }

        $('#winner').text(winnerText);

        if (this.winner != null) {
            this.createChart(this.movies);
        }

        if (this.isHost === true) {
            this.addDOMListener(this.endButton, 'click', () => {
                this.socket.emit('end_night');
            }).show(this.animTime);

            this.addDOMListener(this.newMovieButton, 'click', () => {
                this.socket.emit('new_round');
            }).show(this.animTime);
        }
    }

    onViewHidden() {
        this.endButton.hide();
        this.newMovieButton.hide();
        // Destroy the existing chart so that a new one can be created
        if (this.voteChart != null) {
            this.voteChart.destroy();
        }
        this.canvas.hide();
    }
}

ResultsView.viewName = 'results';