import { View } from './view.js';

export class HostView extends View {
    constructor(socket, animTime, votingSystems, isPasswordRequired) {
        super(HostView.viewName, socket, animTime);
        this.votingSystems = votingSystems;
        this.isPasswordRequired = isPasswordRequired;
        this.nightInput = $('#nightName');
        this.votingSystemInput = $('#votingSystem');
        this.numSuggestionsInput = $('#numSuggestions');
        this.passwordInput = $('#password');
        this.errorMessage = $('#errorMessage');
    }

    formSubmit() {
        const name = this.nightInput.val().toString().trim();
        const votingSystem = this.votingSystemInput.val();
        const numSuggestions = this.numSuggestionsInput.val();
        const password = this.passwordInput.val();

        const nightInfo = {
            name,
            votingSystem,
            numSuggestions,
            password
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

        if (this.isPasswordRequired === true) {
            $('#passwordLabel').show();
            this.passwordInput.show();
        }

        this.addDOMListener($('#startVotingForm'), 'submit', this.formSubmit);

        this.addSocketListener('wrong_password', () => {
            this.errorMessage
                .text(`The password you have entered is incorrect.`)
                .show(this.animTime);
        });
    }

    onViewHidden() {
        this.nightInput.val('');
        this.errorMessage.hide();
    }
}

HostView.viewName = 'host';
