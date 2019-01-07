export class View {
    constructor(name, socket, animTime) {
        this.viewName = name;
        this.container = $(`#${name}View`);
        this.socket = socket;
        this.animTime = animTime;
        this.socketListeners = [];
        this.domListeners = [];
    }

    // Show this page
    show() {
        this.container.show(this.animTime);
        this.onViewShown();
    }

    // Hide this page
    hide() {
        this.container.hide(this.animTime);
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

    // Adds an event listener for the associated socket - need to call this so the event is removed when the page is hidden
    addSocketListener(eventName, callback) {
        const func = callback.bind(this);

        this.socket.on(eventName, func);

        this.socketListeners.push({
            'name': eventName,
            'func': func
        });

        // Return the socket for chaining purposes
        return this.socket;
    }

    // Adds an event listener for the associated jQuery object - need to call this so the event is removed when the page is hidden
    addDOMListener(element, eventName, callback) {
        const func = callback.bind(this);

        element.on(eventName, func);

        this.domListeners.push({
            'element': element,
            'name': eventName,
            'func': func
        });

        // Return the jQuery object for chaining purposes
        return element;
    }

    // Clear out all of the event listeners
    clearListeners() {
        this.socketListeners.forEach(listener => this.socket.off(listener.name, listener.func));
        this.socketListeners.length = 0;
        this.domListeners.forEach(listener => listener.element.off(listener.name, listener.func));
        this.domListeners.length = 0;
    }
}