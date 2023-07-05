import { View } from './view.js';

export class UsernameView extends View {
    constructor(socket, animTime, userToken) {
        super(UsernameView.viewName, socket, animTime);
        this.userToken = userToken;
        this.usernameInput = document.querySelector('#username');
    }

    formSubmit(event) {
        // Stop the page from refreshing
        event.preventDefault();

        const username = this.usernameInput.value.trim();

        this.socket.emit('new_user', {
            token: this.userToken,
            username
        });
    }

    onViewShown() {
        this.addDOMListener(document.querySelector('#usernameForm'), 'submit', this.formSubmit);
    }

    onViewHidden() {
        this.usernameInput.value = '';
    }
}

UsernameView.viewName = 'username';