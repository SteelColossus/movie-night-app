import { View } from './view.js';

export class HostView extends View {
    constructor(socket, animTime, votingSystems) {
        super(HostView.viewName, socket, animTime);
        this.votingSystems = votingSystems;
        this.nightInput = $('#nightName');
        this.votingSystemInput = $('#votingSystem');
        this.numSuggestionsInput = $('#numSuggestions');
    }

    formSubmit() {
        const name = this.nightInput.val().toString().trim();
        const votingSystem = this.votingSystemInput.val();
        const numSuggestions = this.numSuggestionsInput.val();
        const nightInfo = {
            name,
            votingSystem,
            numSuggestions
        };

        this.socket.emit('host_night', nightInfo);

        // Stop the page from refreshing
        return false;
    }

    onViewShown() {
        this.votingSystemInput.empty();

        this.votingSystems.forEach((system) => {
            this.votingSystemInput.append($('<option>').val(system).text(system));
        });

        this.numSuggestionsInput.empty();

        for (let i = 1; i <= 3; i++) {
            this.numSuggestionsInput.append($('<option>').val(i).text(i));
        }

        this.addDOMListener($('#startVotingForm'), 'submit', this.formSubmit);
    }

    onViewHidden() {
        this.nightInput.val('');
    }
}

HostView.viewName = 'host';