import { View } from './view.js';

export class UsernameView extends View {
    constructor(socket, animTime) {
        super('username', socket, animTime);
        this.usernameInput = $('#username');
    }

    formSubmit() {
        let username = this.usernameInput.val().toString().trim();

        this.socket.emit('new_user', {
            "token": this.userToken,
            "username": username
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