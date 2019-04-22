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

export function getTimeStringFromRuntime(runtime) {
    const mins = parseInt(runtime.substring(0, runtime.indexOf(' ')), 10);
    const hours = Math.floor(mins / 60);
    const minsLeft = mins % 60;
    let timeString = '';

    if (hours > 0) {
        timeString += `${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    if (hours > 0 && minsLeft > 0) {
        timeString += ' ';
    }

    if (minsLeft > 0) {
        timeString += `${minsLeft} min${minsLeft !== 1 ? 's' : ''}`;
    }

    return timeString;
}

export function setBackgroundColorRedToGreen(cell) {
    const num = parseFloat(cell.text());
    const g = Math.round(num * (255 / 10));
    const r = 255 - g;
    const b = 0;
    const a = 0.5;

    cell.css('background-color', `rgba(${r},${g},${b},${a})`);
}

export function setAsMovieDetailsLink(cell, movieId) {
    cell.addClass('subtle-link')
        .attr('title', 'View more details for this movie')
        .click(() => {
            window.open(`/movie?id=${movieId}`);
        });
}