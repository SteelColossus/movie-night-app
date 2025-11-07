import { View } from './view.js';

export class UsernameView extends View {
    constructor(socket, animTime, userToken) {
        super(UsernameView.viewName, socket, animTime);
        this.userToken = userToken;
        this.usernameInput = $('#username');
    }

    formSubmit() {
        const username = this.usernameInput.val().toString().trim();

        this.socket.emit('new_user', {
            token: this.userToken,
            username
        });

        // Stop the page from refreshing
        return false;
    }

    onViewShown() {
        this.addDOMListener($('#usernameForm'), 'submit', this.formSubmit);
    }

    onViewHidden() {
        this.usernameInput.val('');
    }
}

UsernameView.viewName = 'username';
