import { View } from './view.js';
import { createTableRow, setAsMovieDetailsLink, pluralize } from './viewFunctions.js';

export class SearchView extends View {
    constructor(socket, animTime, suggestedMovies, maxSuggestions) {
        super(SearchView.viewName, socket, animTime);
        this.suggestedMovies = suggestedMovies;
        this.maxSuggestions = maxSuggestions;
        this.suggestionInput = document.querySelector('#suggestion');
        this.suggestionsLabel = document.querySelector('#suggestionsLabel');
        this.movieSuggestionsList = document.querySelector('#movieSuggestionsList');
        this.noSuggestionsLabel = document.querySelector('#noSuggestionsLabel');
        this.searchResults = document.querySelector('#searchResults');
        this.errorMessage = document.querySelector('#errorMessage');
    }

    formSubmit(event) {
        // Stop the page from refreshing
        event.preventDefault();

        const suggestion = this.suggestionInput.value.trim();

        if (suggestion.length > 0) {
            this.socket.emit('movie_search', suggestion);
        }
    }

    updateSuggestionsLabel() {
        const suggestionsLeft = this.maxSuggestions - this.suggestedMovies.length;

        this.suggestionsLabel.textContent = `You have ${pluralize('suggestion', suggestionsLeft)} left.`;

        if (suggestionsLeft > 0) {
            this.noSuggestionsLabel.style.display = 'none';
        } else {
            this.noSuggestionsLabel.style.display = '';
        }
    }

    clearSearch() {
        this.suggestionInput.value = '';
        this.searchResults.style.display = 'none';
    }

    updateSuggestedMovies() {
        this.movieSuggestionsList.replaceChildren();

        this.suggestedMovies.forEach((movie) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${movie.title} (${movie.year})`;
            setAsMovieDetailsLink(listItem, movie.id);
            this.movieSuggestionsList.append(listItem);
        });
    }

    handleSearch(searchData) {
        if (searchData.success === false) {
            this.errorMessage.textContent = `Error: ${searchData.errorMessage}`;
            this.errorMessage.style.display = '';
            return;
        }

        this.errorMessage.style.display = 'none';

        const suggestTableBody = document.querySelector('#suggestionTable > tbody');

        // Remove all the existing suggestions
        suggestTableBody.replaceChildren();

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
                        const chooseButton = document.createElement('input');
                        chooseButton.type = 'button';
                        chooseButton.value = 'Choose!';
                        chooseButton.classList.add('btn', 'btn-primary');
                        chooseButton.dataset.movieId = result.id;
                        chooseButton.addEventListener('click', () => {
                            this.socket.emit('movie_chosen', chooseButton.dataset.movieId);
                        });

                        cell.append(chooseButton);
                    }
                }
            ]);

            suggestTableBody.append(tableRow);
        });

        this.searchResults.style.display = '';
    }

    handleMovieRejected(message) {
        const fullMessage = `${message}\nPlease choose a different movie.`;

        // eslint-disable-next-line no-alert
        alert(fullMessage);
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

        // eslint-disable-next-line no-unused-vars
        const popover = new bootstrap.Popover(document.querySelector('#movieInfo'), {
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

        this.addDOMListener(document.querySelector('#movieSearchForm'), 'submit', this.formSubmit);

        this.addDOMListener(document.querySelector('#viewSuggestionsButton'), 'click', () => {
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