import type { Socket } from 'socket.io';

import { View } from './view.js';

export class UsernameView extends View {
    public static readonly viewName = 'username';

    private readonly userToken: number;

    private readonly usernameInput: JQuery;

    public constructor(socket: Socket, animTime: number, userToken: number) {
        super(UsernameView.viewName, socket, animTime);
        this.userToken = userToken;
        this.usernameInput = $('#username');
    }

    protected onViewShown(): void {
        this.addDOMListener($('#usernameForm'), 'submit', () => this.formSubmit());
    }

    protected onViewHidden(): void {
        this.usernameInput.val('');
    }

    private formSubmit(): false {
        const username = (this.usernameInput.val() as string).trim();

        this.socket.emit('new_user', {
            token: this.userToken,
            username
        });

        // Stop the page from refreshing
        return false;
    }
}