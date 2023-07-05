export function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

export function createTableRow(objList) {
    const tableRow = document.createElement('tr');

    objList.forEach((obj) => {
        const cell = document.createElement('td');

        if (obj.text != null) {
            cell.textContent = obj.text;
        }

        if (obj.func != null) {
            obj.func(cell);
        }

        tableRow.append(cell);
    });

    return tableRow;
}

export function pluralize(singular, value) {
    return `${value} ${singular}${value !== 1 ? 's' : ''}`;
}

export function getTimeStringFromRuntime(runtime) {
    const mins = parseInt(runtime.substring(0, runtime.indexOf(' ')), 10);
    const hours = Math.floor(mins / 60);
    const minsLeft = mins % 60;
    let timeString = '';

    if (hours > 0) {
        timeString += pluralize('hour', hours);
    }

    if (hours > 0 && minsLeft > 0) {
        timeString += ' ';
    }

    if (minsLeft > 0) {
        timeString += pluralize('min', minsLeft);
    }

    return timeString;
}

export function setBackgroundColorRedToGreen(element) {
    const num = parseFloat(element.textContent);
    const g = Math.round(num * (255 / 10));
    const r = 255 - g;
    const b = 0;
    const a = 0.5;

    element.style.backgroundColor = `rgba(${r},${g},${b},${a})`;
}

export function setAsMovieDetailsLink(element, movieId) {
    element.classList.add('subtle-link');
    element.setAttribute('title', 'View more details for this movie');
    element.addEventListener('click', () => {
        window.open(`/movie?id=${movieId}`);
    });
}