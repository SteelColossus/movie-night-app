export async function show(element, duration = 0) {
    if (!element) {
        return;
    }

    element.style.display = '';

    const height = getComputedStyle(element).height;

    const animation = element.animate(
        [
            { opacity: 0, height: '0px' },
            { opacity: 1, height }
        ],
        {
            duration
        }
    );
    await animation.finished;
}

export async function hide(element, duration = 0) {
    if (!element) {
        return;
    }

    const height = getComputedStyle(element).height;

    const animation = element.animate(
        [
            { opacity: 1, height },
            { opacity: 0, height: '0px' }
        ],
        {
            duration
        }
    );
    await animation.finished;

    element.style.display = 'none';
}
