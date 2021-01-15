import type { Socket } from 'socket.io';

import { View } from './view.js';

export class HostView extends View {
    public static readonly viewName = 'host';

    private readonly votingSystems: string[];

    private readonly isPasswordRequired: boolean;

    private readonly nightInput: JQuery;

    private readonly votingSystemInput: JQuery;

    private readonly numSuggestionsInput: JQuery;

    private readonly passwordInput: JQuery;

    private readonly errorMessage: JQuery;

    public constructor(socket: Socket, animTime: number, votingSystems: string[], isPasswordRequired: boolean) {
        super(HostView.viewName, socket, animTime);
        this.votingSystems = votingSystems;
        this.isPasswordRequired = isPasswordRequired;
        this.nightInput = $('#nightName');
        this.votingSystemInput = $('#votingSystem');
        this.numSuggestionsInput = $('#numSuggestions');
        this.passwordInput = $('#password');
        this.errorMessage = $('#errorMessage');
    }

    protected onViewShown(): void {
        this.votingSystemInput.empty();

        this.votingSystems.forEach((system) => {
            this.votingSystemInput.append($('<option>').val(system).text(system));
        });

        this.numSuggestionsInput.empty();

        for (let i = 1; i <= 3; i++) {
            this.numSuggestionsInput.append($('<option>').val(i).text(i));
        }

        if (this.isPasswordRequired) {
            $('#passwordLabel').show();
            this.passwordInput.show();
        }

        this.addDOMListener($('#startVotingForm'), 'submit', () => this.formSubmit());

        this.addSocketListener('wrong_password', () => {
            this.errorMessage.text(`The password you have entered is incorrect.`).show(this.animTime);
        });
    }

    protected onViewHidden(): void {
        this.nightInput.val('');
        this.errorMessage.hide();
    }

    private formSubmit(): false {
        const name = (this.nightInput.val() as string).trim();
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
}