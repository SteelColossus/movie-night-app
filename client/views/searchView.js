import { View } from './view.js';
import { appendTableRow } from './viewFunctions.js';

export class SearchView extends View {
    constructor(socket, animTime) {
        super(SearchView.viewName, socket, animTime);
        this.suggestionInput = $('#suggestion');
        this.searchResults = $('#searchResults');
        this.errorMessage = $('#errorMessage');
    }

    formSubmit() {
        let suggestion = this.suggestionInput.val().toString().trim();

        if (suggestion.length > 0) {
            this.socket.emit('movie_search', suggestion);
        }

        // Stop the page from refreshing
        return false;
    }

    handleSearch(searchData) {
        if (searchData.success === false) {
            this.errorMessage.text(`Error: ${searchData.errorMessage}`).show(this.animTime);
            return;
        }

        this.errorMessage.hide(this.animTime);

        const suggestTable = $('#suggestionTable');

        // Remove all the existing suggestions
        suggestTable.find('tr:not(:first-child)').remove();

        const searchDataResults = searchData.results;

        // Create the suggestion table from the API results
        searchDataResults.forEach((result) => {
            appendTableRow(suggestTable, [
                { "text": result.title },
                { "text": result.year },
                {
                    "func": (cell) => {
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
        });

        this.searchResults.show(this.animTime);
    }

    handleMovieRejected(message) {
        const fullMessage = `${message}\nPlease choose a different movie.`;

        alert(fullMessage); // eslint-disable-line no-alert
    }

    onViewShown() {
        $('#movieInfo').popover({
            "trigger": "hover focus",
            "placement": "bottom",
            "html": true,
            "title": "Movie Night Rules:",
            "content": `
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

        this.addSocketListener('movie_search_results', this.handleSearch);

        this.addSocketListener('request_different_movie', this.handleMovieRejected);
    }

    onViewHidden() {
        this.suggestionInput.val('');
        this.searchResults.hide();
    }
}

SearchView.viewName = 'search';