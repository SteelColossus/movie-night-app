export class View {
    constructor(name, animTime) {
        this.viewName = name;
        this.container = $(`#${name}View`);
        this.animTime = animTime;
    }

    show() {
        this.container.show(this.animTime);
        this.onViewShown();
    }

    hide() {
        this.container.hide(this.animTime);
        this.onViewHidden();
    }

    onViewShown() {
        // Since this is emulating an abstract class, we do nothing here
    }

    onViewHidden() {
        // Since this is emulating an abstract class, we do nothing here
    }
}