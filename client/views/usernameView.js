import { View } from './view.js';

export class UsernameView extends View {
    constructor(socket, animTime) {
        super('username', animTime);
        this.socket = socket;
        this.usernameInput = $('#username');
    }

    formSubmit() {
        let username = this.usernameInput.val().toString().trim();

        this.socket.emit('new_user', {
            "token": this.userToken,
            "username": username
        });

        // Stops refresh and connect of new user
        return false;
    }

    onViewShown() {
        $('#usernameForm').submit(this.formSubmit.bind(this));
    }

    onViewHidden() {
        this.usernameInput.val('');
    }
}