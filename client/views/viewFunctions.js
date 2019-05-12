export function sumVotes(votesObj) {
    return Object.values(votesObj).reduce((a, b) => a + b, 0);
}

export function appendTableRow(table, objList) {
    const tableRow = $('<tr>');

    objList.forEach((obj) => {
        const cell = $('<td>');

        if (obj.text != null) {
            cell.text(obj.text);
        }

        if (obj.func != null) {
            obj.func(cell);
        }

        tableRow.append(cell);
    });

    table.append(tableRow);
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
    const num = parseFloat(element.text());
    const g = Math.round(num * (255 / 10));
    const r = 255 - g;
    const b = 0;
    const a = 0.5;

    element.css('background-color', `rgba(${r},${g},${b},${a})`);
}

export function setAsMovieDetailsLink(element, movieId) {
    element.addClass('subtle-link')
        .attr('title', 'View more details for this movie')
        .click(() => {
            window.open(`/movie?id=${movieId}`);
        });
}