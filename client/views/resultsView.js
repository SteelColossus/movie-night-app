import { View } from './view.js';
import { sumVotes, pluralize } from './viewFunctions.js';

export class ResultsView extends View {
    constructor(socket, animTime, isHost, movies, winner, users) {
        super(ResultsView.viewName, socket, animTime);
        this.isHost = isHost;
        this.movies = movies;
        this.winner = movies.find((movie) => movie.id === winner);
        this.users = users;
        this.canvas = $('#voteChart');
        this.endButton = $('#endButton');
        this.newMovieButton = $('#newMovieButton');
    }

    createChart(users, movies) {
        const datasets = [];
        let noneHaveVotes = true;

        const labels = movies.map((movie) => movie.title);

        for (const [id, user] of Object.entries(users)) {
            const dataset = {
                label: user.username,
                data: []
            };

            // eslint-disable-next-line no-loop-func
            movies.forEach((movie) => {
                const numVotes = movie.votes[id] || 0;
                dataset.data.push(numVotes);

                if (numVotes > 0) {
                    noneHaveVotes = false;
                }
            });

            datasets.push(dataset);
        }

        if (noneHaveVotes === false) {
            const chartColors = [
                [255, 99, 132],
                [54, 162, 235],
                [255, 206, 86],
                [75, 192, 192],
                [153, 102, 255],
                [255, 159, 64]
            ];

            for (let i = 0; i < datasets.length; i++) {
                const color = chartColors[i % chartColors.length];
                const dataset = datasets[i];

                dataset.backgroundColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`;
                dataset.borderColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                dataset.borderWidth = 1;
            }

            this.voteChart = new Chart(this.canvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets
                },
                options: {
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [
                            {
                                stacked: true
                            }
                        ],
                        yAxes: [
                            {
                                stacked: true,
                                ticks: {
                                    beginAtZero: true,
                                    precision: 1
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
            this.createChart(this.users, this.movies);
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
