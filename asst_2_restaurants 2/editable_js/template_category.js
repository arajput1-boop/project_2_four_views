/**
 * CATEGORY VIEW
 * For: a local reporter (or a curious resident) asking "which kinds of business have the most problems?"
 * Emphasises: how the types of business compare with each other. Individual inspections are tucked inside each group.
 * Leaves out: dates and exact result wording, until you open a group.
 */
import {
  escapeHTML,
  formatDate,
  cleanCity,
  cleanCategory,
  countFailedChecks,
  groupByType,
  resultPill,
} from './helpers.js';

let groups = [];

function itemRow(inspection) {
  const failed = countFailedChecks(inspection);
  /*html*/
  return `
    <li class="group-item">
      <div>
        <strong>${escapeHTML(inspection.name)}</strong>
        <span class="group-item-meta">${escapeHTML(cleanCity(inspection.city))} · ${formatDate(inspection.inspection_date)} · ${escapeHTML(cleanCategory(inspection.category))}</span>
      </div>
      <div class="group-item-result">
        ${resultPill(inspection.inspection_results)}
        <span class="failed-count ${failed > 0 ? 'failed-some' : 'failed-none'}" title="Failed checks">${failed} failed</span>
      </div>
    </li>`;
}

function groupMarkup(group, maxAverage) {
  // Most failed checks first inside a group, newest first when tied
  const items = [...group.items].sort(
    (a, b) =>
      countFailedChecks(b) - countFailedChecks(a) ||
      b.inspection_date.localeCompare(a.inspection_date)
  );
  const meterWidth = maxAverage === 0 ? 0 : Math.round((group.avgFailed / maxAverage) * 100);

  /*html*/
  return `
    <details class="group">
      <summary class="group-summary">
        <span class="group-name">${escapeHTML(group.label)}</span>
        <span class="group-stat"><strong>${group.count}</strong> inspections</span>
        <span class="group-stat"><strong>${group.avgFailed.toFixed(2)}</strong> failed checks per inspection</span>
        <span class="group-meter" aria-hidden="true"><span class="group-meter-fill" style="width: ${meterWidth}%"></span></span>
      </summary>
      <ul class="group-items">${items.map(itemRow).join('')}</ul>
    </details>`;
}

function listMarkup(sortBy) {
  // Sort a copy so the grouping itself stays as it was
  const ordered = [...groups].sort((a, b) => {
    const isLast = (group) => (group.label === 'Other types' || group.label === 'Not listed' ? 1 : 0);
    const byChoice = sortBy === 'failed' ? b.avgFailed - a.avgFailed : b.count - a.count;
    return isLast(a) - isLast(b) || byChoice;
  });
  const maxAverage = Math.max(...groups.map((group) => group.avgFailed));
  return ordered.map((group) => groupMarkup(group, maxAverage)).join('');
}

function showCategories(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<h2 class="view-title">📂 Category View</h2><p class="error">There are no inspections to show.</p>';
  }

  groups = groupByType(data);
  const overallAverage = data.reduce((sum, inspection) => sum + countFailedChecks(inspection), 0) / data.length;

  /*html*/
  return `
    <h2 class="view-title">📂 Category View</h2>
    <p class="audience">For a reporter comparing types of business</p>
    <p class="view-description">
      Each row is one type of business. The bar shows its average number of failed checks per inspection
      (across all ${data.length} inspections the average is ${overallAverage.toFixed(2)}).
      Open a row to see its inspections. Types with fewer than 3 inspections are joined as "Other types",
      because an average over one or two inspections says very little.
    </p>
    <div class="group-controls">
      <label for="group-sort">Order the groups by</label>
      <select id="group-sort">
        <option value="count">Most inspections</option>
        <option value="failed">Most failed checks per inspection</option>
      </select>
    </div>
    <div id="group-list">${listMarkup('count')}</div>
  `;
}

// Listen on the whole document, because this view's HTML is replaced whenever you switch views
document.addEventListener('change', (event) => {
  if (event.target.id !== 'group-sort') return;
  document.querySelector('#group-list').innerHTML = listMarkup(event.target.value);
});

export default showCategories;
