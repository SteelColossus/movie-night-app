import type { Socket } from 'socket.io';

import type { MovieResults, SelectableMovie } from '../../server/common.js';

import { View } from './view.js';
import { createTableRow, setAsMovieDetailsLink, pluralize } from './viewFunctions.js';

export class SearchView extends View {
    public static readonly viewName = 'search';

    private readonly suggestedMovies: SelectableMovie[];

    private readonly maxSuggestions: number;

    private readonly suggestionInput: JQuery;

    private readonly suggestionsLabel: JQuery;

    private readonly movieSuggestionsList: JQuery;

    private readonly noSuggestionsLabel: JQuery;

    private readonly searchResults: JQuery;

    private readonly errorMessage: JQuery;

    public constructor(socket: Socket, animTime: number, suggestedMovies: SelectableMovie[], maxSuggestions: number) {
        super(SearchView.viewName, socket, animTime);
        this.suggestedMovies = suggestedMovies;
        this.maxSuggestions = maxSuggestions;
        this.suggestionInput = $('#suggestion');
        this.suggestionsLabel = $('#suggestionsLabel');
        this.movieSuggestionsList = $('#movieSuggestionsList');
        this.noSuggestionsLabel = $('#noSuggestionsLabel');
        this.searchResults = $('#searchResults');
        this.errorMessage = $('#errorMessage');
    }

    protected onViewShown(): void {
        this.updateSuggestionsLabel();
        this.updateSuggestedMovies();

        $('#movieInfo').popover({
            container: 'html',
            trigger: 'hover focus',
            placement: 'bottom',
            html: true,
            title: 'Movie Night Rules:',
            content: `
                <ul>
                    <li>NO shorts</li>
                    <li>NO documentaries</li>
                    <li>NO anime</li>
                    <li>NO series</li>
                    <li>NO porn</li>
                    <li>NO anime series</li>
                    <li>NO anime porn series</li>
                </ul>
            `
        });

        this.addDOMListener($('#movieSearchForm'), 'submit', () => this.formSubmit());

        this.addDOMListener($('#viewSuggestionsButton'), 'click', () => {
            // Slight hack here, just set the hash instead of going through the proper internal function to navigate to the suggestions page
            window.location.hash = 'suggestions';
        });

        this.addSocketListener('movie_search_results', (searchData: MovieResults) => {
            this.handleSearch(searchData);
        });

        this.addSocketListener('request_different_movie', (message: string) => {
            this.handleMovieRejected(message);
        });

        this.addSocketListener('movie_suggestion_added', (movie: SelectableMovie) => {
            this.handleSuggestionAdded(movie);
        });
    }

    protected onViewHidden(): void {
        this.clearSearch();
    }

    private formSubmit(): false {
        const suggestion = (this.suggestionInput.val() as string).trim();

        if (suggestion.length > 0) {
            this.socket.emit('movie_search', suggestion);
        }

        // Stop the page from refreshing
        return false;
    }

    private updateSuggestionsLabel(): void {
        const suggestionsLeft = this.maxSuggestions - this.suggestedMovies.length;

        this.suggestionsLabel.text(`You have ${pluralize('suggestion', suggestionsLeft)} left.`);

        if (suggestionsLeft > 0) {
            this.noSuggestionsLabel.hide();
        } else {
            this.noSuggestionsLabel.show();
        }
    }

    private clearSearch(): void {
        this.suggestionInput.val('');
        this.searchResults.hide();
    }

    private updateSuggestedMovies(): void {
        this.movieSuggestionsList.empty();

        this.suggestedMovies.forEach((movie) => {
            const listItem = $('<li>').text(`${movie.title} (${movie.year})`);
            setAsMovieDetailsLink(listItem, movie.id);
            this.movieSuggestionsList.append(listItem);
        });
    }

    private handleSearch(searchData: MovieResults): void {
        if (!searchData.success) {
            this.errorMessage.text(`Error: ${searchData.errorMessage}`).show(this.animTime);
            return;
        }

        this.errorMessage.hide(this.animTime);

        const suggestTableBody = $('#suggestionTable > tbody');

        // Remove all the existing suggestions
        suggestTableBody.empty();

        const searchDataResults = searchData.results;

        // Create the suggestion table from the API results
        searchDataResults.forEach((result) => {
            const tableRow = createTableRow([
                {
                    text: result.title,
                    func: (cell: JQuery): void => {
                        setAsMovieDetailsLink(cell, result.id);
                    }
                },
                { text: result.year },
                {
                    func: (cell: JQuery): void => {
                        const chooseButton = $('<input>')
                            .prop('type', 'button')
                            .val('Choose!')
                            .addClass('btn btn-primary')
                            .data('movie-id', result.id)
                            .click(() => {
                                this.socket.emit('movie_chosen', chooseButton.data('movie-id'));
                            });

                        cell.append(chooseButton);
                    }
                }
            ]);

            suggestTableBody.append(tableRow);
        });

        this.searchResults.show(this.animTime);
    }

    private handleMovieRejected(message: string): void {
        const fullMessage = `${message}\nPlease choose a different movie.`;

        alert(fullMessage); // eslint-disable-line no-alert
    }

    private handleSuggestionAdded(movie: SelectableMovie): void {
        this.clearSearch();

        if (this.suggestedMovies.length >= this.maxSuggestions) {
            this.suggestedMovies.length = 0;
        }

        this.suggestedMovies.push(movie);
        this.updateSuggestionsLabel();
        this.updateSuggestedMovies();
    }
}