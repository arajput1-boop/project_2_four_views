/**
 * TABLE VIEW
 * For: a health inspector deciding which places to visit next.
 * Emphasises: exact values you can scan and sort, especially how many safety checks each place failed.
 * Leaves out: addresses, owners, and the 15 individual checks (the Charts view covers those).
 */
import {
  escapeHTML,
  orNotListed,
  formatDate,
  cleanCity,
  cleanCategory,
  countFailedChecks,
  resultPill,
} from './helpers.js';

// The table is re-drawn every time you sort, so these live outside the functions
let rows = [];
let sortState = { key: 'failed', direction: 'descending' };

// One entry per column. "text" columns sort A-Z, "number" columns sort by size.
const COLUMNS = [
  { key: 'name', label: 'Business', kind: 'text' },
  { key: 'category', label: 'Type', kind: 'text' },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'date', label: 'Inspected', kind: 'date' },
  { key: 'result', label: 'Result', kind: 'text' },
  { key: 'failed', label: 'Failed checks (of 15)', kind: 'number' },
];

// Before: one big record per inspection, with ~30 fields (15 of them checks)
// After:  one flat row with only the 6 values this table needs, and the failed checks already counted
function makeRows(data) {
  return data.map((inspection) => ({
    name: inspection.name,
    category: cleanCategory(inspection.category),
    city: cleanCity(inspection.city),
    date: inspection.inspection_date,
    result: orNotListed(inspection.inspection_results),
    failed: countFailedChecks(inspection),
  }));
}

function sortRows(list, { key, direction }) {
  const flip = direction === 'ascending' ? 1 : -1;
  return [...list].sort((a, b) => {
    const first = a[key];
    const second = b[key];
    const difference =
      typeof first === 'number' ? first - second : String(first).localeCompare(String(second));
    // If two rows tie, fall back to the business name so the order is stable
    return difference * flip || a.name.localeCompare(b.name);
  });
}

function headerCell(column) {
  const isSorted = sortState.key === column.key;
  const arrow = isSorted ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕';
  return `
    <th scope="col"${isSorted ? ` aria-sort="${sortState.direction}"` : ''} class="${column.kind === 'number' ? 'col-number' : ''}">
      <button type="button" class="sort-button" data-sort="${column.key}">
        ${column.label} <span aria-hidden="true" class="sort-arrow">${arrow}</span>
      </button>
    </th>`;
}

function bodyRow(row) {
  const failedClass = row.failed > 0 ? 'failed-some' : 'failed-none';
  return `
    <tr>
      <th scope="row" class="business-name">${escapeHTML(row.name)}</th>
      <td>${escapeHTML(row.category)}</td>
      <td>${escapeHTML(row.city)}</td>
      <td class="col-date">${formatDate(row.date)}</td>
      <td>${resultPill(row.result)}</td>
      <td class="col-number"><span class="failed-count ${failedClass}">${row.failed}</span></td>
    </tr>`;
}

function tableMarkup() {
  const sorted = sortRows(rows, sortState);
  const column = COLUMNS.find((item) => item.key === sortState.key);
  /*html*/
  return `
    <table class="restaurant-table inspection-table">
      <caption>
        Food safety inspections in Prince George's County: ${rows.length} inspections, sorted by
        ${column.label.toLowerCase()} (${sortState.direction}). Select a column heading to sort by it.
      </caption>
      <thead><tr>${COLUMNS.map(headerCell).join('')}</tr></thead>
      <tbody>${sorted.map(bodyRow).join('')}</tbody>
    </table>`;
}

function showTable(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<h2 class="view-title">📊 Table View</h2><p class="error">There are no inspections to show.</p>';
  }

  rows = makeRows(data);
  sortState = { key: 'failed', direction: 'descending' };

  // Three numbers an inspector wants before scanning the rows
  const withFailures = rows.filter((row) => row.failed > 0).length;
  const closures = rows.filter((row) => row.result === 'Facility Closed').length;

  /*html*/
  return `
    <h2 class="view-title">📊 Table View</h2>
    <p class="audience">For a health inspector planning visits</p>
    <p class="view-description">Sorted so the places that failed the most checks come first. Select any column heading to sort by it.</p>
    <p class="table-summary">
      <strong>${rows.length}</strong> inspections ·
      <strong>${withFailures}</strong> with at least one failed check ·
      <strong>${closures}</strong> facility closures
    </p>
    <p id="sort-status" class="visually-hidden" aria-live="polite"></p>
    <div id="table-wrap" class="table-scroll" role="region" aria-label="Inspections table. Scrolls sideways on small screens." tabindex="0">
      ${tableMarkup()}
    </div>
  `;
}

// The page replaces this view's HTML whenever you switch views, so listen on the whole document once.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.sort-button');
  if (!button) return;

  const key = button.dataset.sort;
  if (sortState.key === key) {
    sortState.direction = sortState.direction === 'ascending' ? 'descending' : 'ascending';
  } else {
    // Numbers and dates are most useful biggest/newest first, words A-Z
    const column = COLUMNS.find((item) => item.key === key);
    sortState = { key, direction: column.kind === 'text' ? 'ascending' : 'descending' };
  }

  document.querySelector('#table-wrap').innerHTML = tableMarkup();
  // The old button was replaced, so put keyboard focus on the new one
  document.querySelector(`.sort-button[data-sort="${key}"]`).focus();
  document.querySelector('#sort-status').textContent =
    `Sorted by ${COLUMNS.find((item) => item.key === key).label}, ${sortState.direction}`;
});

export default showTable;
