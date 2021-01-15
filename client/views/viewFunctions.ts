type CellCallback = (cell: JQuery) => void;

interface CellFunction {
    text?: string;
    func?: CellCallback;
}

export function sumVotes(votes: Map<number, number>): number {
    let sum = 0;

    votes.forEach((value) => {
        sum += value;
    });

    return sum;
}

export function createTableRow(objList: CellFunction[]): JQuery {
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

    return tableRow;
}

export function pluralize(singular: string, value: number): string {
    return `${value} ${singular}${value !== 1 ? 's' : ''}`;
}

export function getTimeStringFromRuntime(runtime: string): string {
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

export function setBackgroundColorRedToGreen(element: JQuery): void {
    const num = parseFloat(element.text());
    const g = Math.round(num * (255 / 10));
    const r = 255 - g;
    const b = 0;
    const a = 0.5;

    element.css('background-color', `rgba(${r},${g},${b},${a})`);
}

export function setAsMovieDetailsLink(element: JQuery, movieId: string): void {
    element.addClass('subtle-link')
        .attr('title', 'View more details for this movie')
        .click(() => {
            window.open(`/movie?id=${movieId}`);
        });
}