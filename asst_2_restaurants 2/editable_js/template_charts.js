/**
 * CHARTS VIEW
 * For: anyone who wants the big picture in a few seconds.
 * Emphasises: patterns across all 150 inspections: who gets inspected, how they turn out, and what goes wrong.
 * Leaves out: individual businesses.
 *
 * This view has two parts:
 *   showCharts(data) returns the HTML: one <canvas> per chart, with a text alternative under each
 *   drawCharts(data) runs after that HTML is on the page, and draws a chart into each <canvas>
 *
 * Chart.js docs: https://www.chartjs.org/docs/latest/getting-started/
 */
import {
  orNotListed,
  groupByType,
  getCheckFields,
  checkLabel,
  countFailedChecks,
} from './helpers.js';

// Colours that stay easy to tell apart (and work for most colour-blind readers)
const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#8c6d00', '#6a3d9a'];
const GREY = '#8a8a8a';

// ============================================
// RESHAPING: your records -> the lists Chart.js wants
// Each function returns { labels, numbers }: a list of labels and a matching list of numbers.
// ============================================

// Chart 1. Before: 150 inspection records. After: one label and one count per type of business.
function countByType(data) {
  const groups = groupByType(data); // joins types with fewer than 3 inspections into "Other types"
  return {
    labels: groups.map((group) => group.label),
    numbers: groups.map((group) => group.count),
  };
}

// Chart 2. Count inspections by result, with the missing ones counted as "Not listed".
function countByResult(data) {
  const counts = {};
  data.forEach((inspection) => {
    const result = orNotListed(inspection.inspection_results);
    counts[result] = (counts[result] || 0) + 1;
  });
  // Object.keys() and Object.values() line up, so sort the pairs together, biggest first
  const sorted = Object.keys(counts)
    .map((label) => ({ label, number: counts[label] }))
    .sort((a, b) => b.number - a.number);
  return {
    labels: sorted.map((pair) => pair.label),
    numbers: sorted.map((pair) => pair.number),
  };
}

// Chart 3. Each inspection has 15 yes/no checks. For each check, in how many inspections was it failed?
function countFailuresByCheck(data) {
  const pairs = getCheckFields(data)
    .map((field) => ({
      label: checkLabel(field),
      number: data.filter((inspection) => inspection[field] === 'Out of Compliance').length,
    }))
    .filter((pair) => pair.number > 0) // checks nobody failed would be empty bars
    .sort((a, b) => b.number - a.number);
  return {
    labels: pairs.map((pair) => pair.label),
    numbers: pairs.map((pair) => pair.number),
  };
}

// Long labels get cut off on a phone. Chart.js draws a label that is a LIST of strings on several lines,
// so split "Food protected from contamination" into ['Food protected', 'from contamination'].
function wrapLabel(text, maxLength = 18) {
  const lines = [];
  let line = '';
  text.split(' ').forEach((word) => {
    if (line && (line + ' ' + word).length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  });
  lines.push(line);
  return lines;
}

// ============================================
// TEXT ALTERNATIVES: one sentence per chart, built from the same numbers the chart uses
// ============================================

function describeTypes({ labels, numbers }, total) {
  const other = labels.indexOf('Other types');
  const otherNote = other === -1 ? '' : ` ${numbers[other]} more are spread across smaller types, grouped as "Other types".`;
  return `${labels[0]} had the most inspections: ${numbers[0]} of ${total}, followed by ${labels[1]} with ${numbers[1]}.${otherNote}`;
}

function describeResults({ labels, numbers }, total) {
  const notListed = numbers[labels.indexOf('Not listed')] || 0;
  const compliant = numbers[labels.indexOf('Compliant - No Health Risk')] || 0;
  return `"${labels[0]}" was the most common result, in ${numbers[0]} of ${total} inspections. Only ${compliant} were "Compliant - No Health Risk", and ${notListed} have no result listed.`;
}

function describeChecks({ labels, numbers }, total, data) {
  const cleanInspections = data.filter((inspection) => countFailedChecks(inspection) === 0).length;
  return `${labels[0]} was the check failed most often: ${numbers[0]} of ${total} inspections, ahead of ${labels[1]} (${numbers[1]}). ${cleanInspections} inspections failed no checks at all.`;
}

function showCharts(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<h2 class="view-title">📈 Charts View</h2><p class="error">There are no inspections to chart.</p>';
  }

  const total = data.length;
  const types = describeTypes(countByType(data), total);
  const results = describeResults(countByResult(data), total);
  const checks = describeChecks(countFailuresByCheck(data), total, data);

  // Each <canvas> is a picture, so it gets a short name (aria-label) and points at its sentence (aria-describedby)
  /*html*/
  return `
    <h2 class="view-title">📈 Charts View</h2>
    <p class="audience">For anyone who wants the big picture</p>
    <p class="view-description">Three questions about all ${total} inspections: what kinds of places are inspected, how do the inspections turn out, and which safety checks go wrong most often?</p>
    <div class="charts-grid">
      <figure class="chart-figure wide">
        <div class="chart-box chart-box-tall">
          <canvas id="chart-types" role="img" aria-label="Bar chart of inspections by type of business" aria-describedby="chart-types-summary"></canvas>
        </div>
        <figcaption id="chart-types-summary" class="chart-summary">${types}</figcaption>
      </figure>
      <figure class="chart-figure">
        <div class="chart-box">
          <canvas id="chart-results" role="img" aria-label="Doughnut chart of inspection results" aria-describedby="chart-results-summary"></canvas>
        </div>
        <figcaption id="chart-results-summary" class="chart-summary">${results}</figcaption>
      </figure>
      <figure class="chart-figure">
        <div class="chart-box">
          <canvas id="chart-checks" role="img" aria-label="Bar chart of how often each safety check was failed" aria-describedby="chart-checks-summary"></canvas>
        </div>
        <figcaption id="chart-checks-summary" class="chart-summary">${checks}</figcaption>
      </figure>
    </div>
  `;
}

function drawCharts(data) {
  // Chart.js is loaded by a <script> tag in index.html. If it didn't load, say so instead of breaking.
  // The sentences under each chart stay on the page, so the numbers are still there.
  if (typeof Chart === 'undefined') {
    document.querySelectorAll('.chart-box').forEach((box) => box.remove());
    document
      .querySelector('.charts-grid')
      .insertAdjacentHTML(
        'beforebegin',
        '<p class="error">Chart.js did not load, so the charts can\'t be drawn. The sentences below still describe them. Check your internet connection and the &lt;script&gt; tag in index.html.</p>'
      );
    return;
  }
  if (!Array.isArray(data) || data.length === 0) return;

  // One chart failing should not stop the other two from drawing
  const draw = (canvasId, settings) => {
    try {
      new Chart(document.querySelector(canvasId), settings);
    } catch (error) {
      console.error(`Could not draw ${canvasId}:`, error);
      document.querySelector(canvasId).closest('.chart-box').innerHTML =
        '<p class="error">This chart could not be drawn. The sentence below still says what it shows.</p>';
    }
  };

  // ---- Chart 1: bar chart. Question: what kinds of places get inspected? ----
  const types = countByType(data);
  draw('#chart-types', {
    type: 'bar',
    data: {
      labels: types.labels,
      datasets: [{ label: 'Number of inspections', data: types.numbers, backgroundColor: PALETTE[0] }],
    },
    options: {
      indexAxis: 'y', // horizontal bars, so long names like "Fast Food - Chain" stay readable
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Inspections by type of business', font: { size: 16 } },
      },
      scales: {
        x: { title: { display: true, text: 'Number of inspections' }, beginAtZero: true, ticks: { precision: 0 } },
        y: { title: { display: true, text: 'Type of business' } },
      },
    },
  });

  // ---- Chart 2: doughnut. Question: how do inspections turn out? ----
  const results = countByResult(data);
  draw('#chart-results', {
    type: 'doughnut',
    data: {
      labels: results.labels,
      datasets: [
        {
          label: 'Inspections',
          data: results.numbers,
          // "Not listed" is always grey so it can't be mistaken for a real result
          backgroundColor: results.labels.map((label, index) =>
            label === 'Not listed' ? GREY : PALETTE[index % PALETTE.length]
          ),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Inspection results', font: { size: 16 } },
      },
    },
  });

  // ---- Chart 3: bar chart. Question: which safety checks go wrong most often? ----
  const checks = countFailuresByCheck(data);
  draw('#chart-checks', {
    type: 'bar',
    data: {
      labels: checks.labels.map((label) => wrapLabel(label)),
      datasets: [{ label: 'Inspections where this check failed', data: checks.numbers, backgroundColor: PALETTE[3] }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Safety checks marked "Out of Compliance"', font: { size: 16 } },
      },
      scales: {
        x: { title: { display: true, text: 'Number of inspections where the check failed' }, beginAtZero: true, ticks: { precision: 0 } },
        // autoSkip: false means every check gets its label, even on a small screen
        y: { title: { display: true, text: 'Safety check' }, ticks: { autoSkip: false } },
      },
    },
  });
}

export { showCharts, drawCharts };
