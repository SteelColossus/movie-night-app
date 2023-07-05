export class View {
    constructor(name, socket, animTime) {
        this.viewName = name;
        this.container = document.querySelector(`#${name}View`);
        this.socket = socket;
        this.animTime = animTime;
        this.socketListeners = [];
        this.domListeners = [];
    }

    // Show this page
    show() {
        this.container.style.display = '';
        this.updateHistory();
        this.onViewShown();
    }

    // Hide this page
    hide() {
        this.container.style.display = 'none';
        this.onViewHidden();
        this.clearListeners();
    }

    // Called when this page is shown
    onViewShown() {
        // Since this is emulating an abstract class, we do nothing here
    }

    // Called when this page is hidden
    onViewHidden() {
        // Since this is emulating an abstract class, we do nothing here
    }

    getHash() {
        return `#${this.viewName}`;
    }

    // Updates the history of the webpage with this view
    updateHistory() {
        const hash = this.getHash();

        if (location.hash !== hash) {
            if (View.isFirst === true) {
                history.replaceState(null, this.viewName, hash);
            } else {
                history.pushState(null, this.viewName, hash);
            }
        }

        View.isFirst = false;
    }

    // Adds an event listener for the associated socket - need to call this so the event is removed when the page is hidden
    addSocketListener(eventName, callback) {
        const func = callback.bind(this);

        this.socket.on(eventName, func);

        this.socketListeners.push({
            name: eventName,
            func
        });

        // Return the socket for chaining purposes
        return this.socket;
    }

    // Adds an event listener for the associated element - need to call this so the event is removed when the page is hidden
    addDOMListener(element, eventName, callback) {
        const func = callback.bind(this);

        element.addEventListener(eventName, func);

        this.domListeners.push({
            element,
            name: eventName,
            func
        });

        // Return the element for chaining purposes
        return element;
    }

    // Clear out all of the event listeners
    clearListeners() {
        this.socketListeners.forEach((listener) => this.socket.off(listener.name, listener.func));
        this.socketListeners.length = 0;
        this.domListeners.forEach((listener) => listener.element.removeEventListener(listener.name, listener.func));
        this.domListeners.length = 0;
    }
}

View.isFirst = true;