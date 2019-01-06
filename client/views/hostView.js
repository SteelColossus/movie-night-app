import { View } from './view.js';

export class HostView extends View {
    constructor(socket, animTime) {
        super('host', socket, animTime);
        this.nightInput = $('#nightName');
        this.votingSystemInput = $('#votingSystem');
    }

    formSubmit() {
        let name = this.nightInput.val().toString().trim();
        let votingSystem = this.votingSystemInput.val();
        let setupDetails = {
            "name": name,
            "votingSystem": votingSystem
        };

        // Allow suggestions
        this.socket.emit('setup_details', setupDetails);

        // Stops refresh and connect of new user
        return false;
    }

    onViewShown() {
        this.votingSystems.forEach((system) => {
            this.votingSystemInput.append($('<option>').val(system).text(system));
        });

        this.addDOMListener($('#startVotingForm'), 'submit', this.formSubmit);
    }

    onViewHidden() {
        this.nightInput.val('');
    }
}