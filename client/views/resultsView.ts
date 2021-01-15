import type { Socket } from 'socket.io';

import type { SelectableMovie, User } from '../../server/common.js';

import { View } from './view.js';
import { sumVotes, pluralize } from './viewFunctions.js';

interface Dataset {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
}

export class ResultsView extends View {
    public static readonly viewName = 'results';

    private readonly isHost: boolean;

    private readonly movies: SelectableMovie[];

    private readonly winner: SelectableMovie | null;

    private readonly users: User[];

    private readonly canvas: JQuery;

    private readonly endButton: JQuery;

    private readonly newMovieButton: JQuery;

    private voteChart: Chart | null = null;

    public constructor(socket: Socket, animTime: number, isHost: boolean, movies: SelectableMovie[], winner: string | null, users: User[]) {
        super(ResultsView.viewName, socket, animTime);
        this.isHost = isHost;
        this.movies = movies;
        this.winner = movies.find((movie) => movie.id === winner) ?? null;
        this.users = users;
        this.canvas = $('#voteChart');
        this.endButton = $('#endButton');
        this.newMovieButton = $('#newMovieButton');
    }

    protected onViewShown(): void {
        let winnerText = 'No one voted for any movies!';
        let numRemainingMovies = 0;

        this.movies.forEach((movie) => {
            if (movie.removed) {
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

        if (this.isHost) {
            this.addDOMListener(this.endButton, 'click', () => {
                this.socket.emit('end_night');
            }).show(this.animTime);

            this.addDOMListener(this.newMovieButton, 'click', () => {
                this.socket.emit('new_round');
            }).show(this.animTime);
        }
    }

    protected onViewHidden(): void {
        this.endButton.hide();
        this.newMovieButton.hide();
        // Destroy the existing chart so that a new one can be created
        if (this.voteChart != null) {
            this.voteChart.destroy();
        }
        this.canvas.hide();
    }

    private createChart(users: User[], movies: SelectableMovie[]): void {
        const datasets = [];
        let noneHaveVotes = true;

        const labels = movies.map((movie) => movie.title);

        for (const user of users) {
            const dataset: Dataset = {
                label: user.username,
                data: [],
                backgroundColor: 'white',
                borderColor: 'white',
                borderWidth: 0
            };

            // eslint-disable-next-line no-loop-func
            for (const movie of movies) {
                const numVotes = movie.votes.get(user.token) ?? 0;
                dataset.data.push(numVotes);

                if (numVotes > 0) {
                    noneHaveVotes = false;
                }
            }

            datasets.push(dataset);
        }

        if (!noneHaveVotes) {
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

            // @ts-expect-error it is not possible to do an import here as chart.js is served as JS by CDN
            this.voteChart = new Chart((this.canvas.get(0) as HTMLCanvasElement), {
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
                                    beginAtZero: true
                                }
                            }
                        ],
                        ticks: {
                            precision: 1
                        }
                    }
                }
            });

            this.canvas.show();
        }
    }
}