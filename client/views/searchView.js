import { View } from './view.js';
import { appendTableRow } from './viewFunctions.js';

export class SearchView extends View {
    constructor(socket, animTime) {
        super('search', animTime);
        this.socket = socket;
        this.suggestionInput = $('#suggestion');
        this.searchResults = $('#searchResults');
    }

    // Get suggestion input
    formSubmit(view) {
        let suggestion = view.suggestionInput.val().toString().trim();

        if (suggestion.length > 0) {
            this.socket.emit('movie_search', suggestion);
        }

        // Stops refresh and connect of new user
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

        let searchResults = searchData.results;

        searchResults.forEach((result) => {
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

    onViewShown() {
        $('#movieInfo').popover({
            "trigger": "hover focus",
            "placement": "bottom",
            "html": true,
            "title": "Movie Night Rules:",
            "content": `
                <ul>
                    <li>NO documentaries</li>
                    <li>NO shorts</li>
                    <li>NO anime</li>
                    <li>NO series</li>
                    <li>NO porn</li>
                    <li>NO anime series</li>
                    <li>NO anime porn series</li>
                </ul>
            `
        });

        $('#movieSearchForm').submit(() => this.formSubmit(this));

        // Form suggestion table from API results
        this.socket.on('movie_search', searchData => this.handleSearch(searchData));
    }

    onViewHidden() {
        this.suggestionInput.val('');
        this.searchResults.hide();
    }
}