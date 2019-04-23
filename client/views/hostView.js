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
        let name = this.nightInput.val().toString().trim();
        let votingSystem = this.votingSystemInput.val();
        let numSuggestions = this.numSuggestionsInput.val();
        let nightInfo = {
            "name": name,
            "votingSystem": votingSystem,
            "numSuggestions": numSuggestions
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

        this.addDOMListener($('#startVotingForm'), 'submit', this.formSubmit);
    }

    onViewHidden() {
        this.nightInput.val('');
    }
}

HostView.viewName = 'host';