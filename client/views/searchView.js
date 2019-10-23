import { View } from './view.js';
import { createTableRow, setAsMovieDetailsLink, pluralize } from './viewFunctions.js';

export class SearchView extends View {
    constructor(socket, animTime, suggestedMovies, maxSuggestions) {
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

    formSubmit() {
        const suggestion = this.suggestionInput.val().toString().trim();

        if (suggestion.length > 0) {
            this.socket.emit('movie_search', suggestion);
        }

        // Stop the page from refreshing
        return false;
    }

    updateSuggestionsLabel() {
        const suggestionsLeft = this.maxSuggestions - this.suggestedMovies.length;

        this.suggestionsLabel.text(`You have ${pluralize('suggestion', suggestionsLeft)} left.`);

        if (suggestionsLeft > 0) {
            this.noSuggestionsLabel.hide();
        } else {
            this.noSuggestionsLabel.show();
        }
    }

    clearSearch() {
        this.suggestionInput.val('');
        this.searchResults.hide();
    }

    updateSuggestedMovies() {
        this.movieSuggestionsList.empty();

        this.suggestedMovies.forEach((movie) => {
            const listItem = $('<li>').text(`${movie.title} (${movie.year})`);
            setAsMovieDetailsLink(listItem, movie.id);
            this.movieSuggestionsList.append(listItem);
        });
    }

    handleSearch(searchData) {
        if (searchData.success === false) {
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
                    func: (cell) => setAsMovieDetailsLink(cell, result.id)
                },
                { text: result.year },
                {
                    func: (cell) => {
                        const chooseButton = $('<input>')
                            .prop('type', 'button')
                            .val('Choose!')
                            .addClass('btn btn-primary')
                            .attr('data-toggle', 'button')
                            .attr('aria-pressed', 'false')
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

    handleMovieRejected(message) {
        const fullMessage = `${message}\nPlease choose a different movie.`;

        alert(fullMessage); // eslint-disable-line no-alert
    }

    handleSuggestionAdded(movie) {
        this.clearSearch();

        if (this.suggestedMovies.length >= this.maxSuggestions) {
            this.suggestedMovies.length = 0;
        }

        this.suggestedMovies.push(movie);
        this.updateSuggestionsLabel();
        this.updateSuggestedMovies();
    }

    onViewShown() {
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

        this.addDOMListener($('#movieSearchForm'), 'submit', this.formSubmit);

        this.addDOMListener($('#viewSuggestionsButton'), 'click', () => {
            // Slight hack here, just set the hash instead of going through the proper internal function to navigate to the suggestions page
            window.location.hash = 'suggestions';
        });

        this.addSocketListener('movie_search_results', this.handleSearch);

        this.addSocketListener('request_different_movie', this.handleMovieRejected);

        this.addSocketListener('movie_suggestion_added', this.handleSuggestionAdded);
    }

    onViewHidden() {
        this.clearSearch();
    }
}

SearchView.viewName = 'search';