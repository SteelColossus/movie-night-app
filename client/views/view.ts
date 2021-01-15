import type { Socket } from 'socket.io';

type Callback = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Listener {
    name: string;
    func: Callback;
}

interface DomListener extends Listener {
    element: JQuery;
}

export class View {
    public static isFirst: boolean;

    public readonly viewName: string;

    protected readonly socket: Socket;

    protected readonly animTime: number;

    private readonly container: JQuery;

    private readonly socketListeners: Listener[];

    private readonly domListeners: DomListener[];

    protected constructor(name: string, socket: Socket, animTime: number) {
        this.viewName = name;
        this.container = $(`#${name}View`);
        this.socket = socket;
        this.animTime = animTime;
        this.socketListeners = [];
        this.domListeners = [];
    }

    // Show this page
    public show(): void {
        this.container.show(this.animTime);
        this.updateHistory();
        this.onViewShown();
    }

    // Hide this page
    public hide(): void {
        this.container.hide(this.animTime);
        this.onViewHidden();
        this.clearListeners();
    }

    // Called when this page is shown
    protected onViewShown(): void {
        // Since this is emulating an abstract class, we do nothing here
    }

    // Called when this page is hidden
    protected onViewHidden(): void {
        // Since this is emulating an abstract class, we do nothing here
    }

    // Adds an event listener for the associated socket - need to call this so the event is removed when the page is hidden
    protected addSocketListener(eventName: string, callback: Callback): Socket {
        const func = callback.bind(this);

        this.socket.on(eventName, func);

        this.socketListeners.push({
            name: eventName,
            func
        });

        // Return the socket for chaining purposes
        return this.socket;
    }

    // Adds an event listener for the associated jQuery object - need to call this so the event is removed when the page is hidden
    protected addDOMListener(element: JQuery, eventName: string, callback: Callback): JQuery {
        const func = callback.bind(this);

        element.on(eventName, func);

        this.domListeners.push({
            element,
            name: eventName,
            func
        });

        // Return the jQuery object for chaining purposes
        return element;
    }

    private getHash(): string {
        return `#${this.viewName}`;
    }

    // Updates the history of the webpage with this view
    private updateHistory(): void {
        const hash = this.getHash();

        if (location.hash !== hash) {
            if (View.isFirst) {
                history.replaceState(null, this.viewName, hash);
            } else {
                history.pushState(null, this.viewName, hash);
            }
        }

        View.isFirst = false;
    }

    // Clear out all of the event listeners
    private clearListeners(): void {
        this.socketListeners.forEach((listener) => this.socket.off(listener.name, listener.func));
        this.socketListeners.length = 0;
        this.domListeners.forEach((listener) => listener.element.off(listener.name, listener.func));
        this.domListeners.length = 0;
    }
}

View.isFirst = true;