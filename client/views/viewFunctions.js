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

export function setBackgroundColorRedToGreen(cell) {
    const num = parseFloat(cell.text());
    const g = Math.round(num * (255 / 10));
    const r = 255 - g;
    const b = 0;
    const a = 0.5;

    cell.css('background-color', `rgba(${r},${g},${b},${a})`);
}