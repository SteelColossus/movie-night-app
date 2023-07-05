import { View } from './view.js';

export class HostView extends View {
    constructor(socket, animTime, votingSystems, isPasswordRequired) {
        super(HostView.viewName, socket, animTime);
        this.votingSystems = votingSystems;
        this.isPasswordRequired = isPasswordRequired;
        this.nightInput = document.querySelector('#nightName');
        this.votingSystemInput = document.querySelector('#votingSystem');
        this.numSuggestionsInput = document.querySelector('#numSuggestions');
        this.passwordInput = document.querySelector('#password');
        this.errorMessage = document.querySelector('#errorMessage');
    }

    formSubmit(event) {
        // Stop the page from refreshing
        event.preventDefault();

        const name = this.nightInput.value.trim();
        const votingSystem = this.votingSystemInput.value;
        const numSuggestions = this.numSuggestionsInput.value;
        const password = this.passwordInput.value;

        const nightInfo = {
            name,
            votingSystem,
            numSuggestions,
            password
        };

        this.socket.emit('host_night', nightInfo);
    }

    onViewShown() {
        this.votingSystemInput.replaceChildren();

        this.votingSystems.forEach((system) => {
            const option = document.createElement('option');
            option.value = system;
            option.text = system;
            this.votingSystemInput.appendChild(option);
        });

        this.numSuggestionsInput.replaceChildren();

        for (let i = 1; i <= 3; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.text = i;
            this.numSuggestionsInput.appendChild(option);
        }

        if (this.isPasswordRequired === true) {
            document.querySelector('#passwordLabel').style.display = '';
            this.passwordInput.style.display = '';
        }

        this.addDOMListener(document.querySelector('#startVotingForm'), 'submit', this.formSubmit);

        this.addSocketListener('wrong_password', () => {
            this.errorMessage.textContent = 'The password you have entered is incorrect.';
            this.errorMessage.style.display = '';
        });
    }

    onViewHidden() {
        this.nightInput.value = '';
        this.errorMessage.style.display = 'none';
    }
}

HostView.viewName = 'host';