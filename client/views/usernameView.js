import { View } from './view.js';

export class UsernameView extends View {
    constructor(socket, animTime) {
        super('username', animTime);
        this.socket = socket;
        this.usernameInput = $('#username');
    }

    formSubmit(view) {
        let username = view.usernameInput.val().toString().trim();

        this.socket.emit('new_user', {
            "token": this.userToken,
            "username": username
        });

        // Stops refresh and connect of new user
        return false;
    }

    onViewShown() {
        $('#usernameForm').submit(() => this.formSubmit(this));
    }

    onViewHidden() {
        this.usernameInput.val('');
    }
}