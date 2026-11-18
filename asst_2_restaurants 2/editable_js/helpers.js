/**
 * HELPERS - shared by the Table, Category and Charts views
 * Small functions that clean up this dataset's quirks in one place.
 */

// This dataset writes missing values as "------" or "N/A". Treat both as missing.
export function isMissing(value) {
  return value === undefined || value === null || value === '' || value === '------' || value === 'N/A';
}

export function orNotListed(value) {
  return isMissing(value) ? 'Not listed' : value;
}

// The data is put into the page with innerHTML, so make sure a name like "A&W" can't break the markup
export function escapeHTML(text) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (character) => replacements[character]);
}

// "2026-05-17T00:00:00.000" -> "May 17, 2026"
export function formatDate(isoDate) {
  if (isMissing(isoDate)) return 'Not listed';
  return new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// The same city is written several ways: "HYATTSVILLE", "Hyattsville", "DISTRICT HTS", "DISTRICT HEIGHTS".
// Make them one spelling, so counting and grouping by city would work.
export function cleanCity(city) {
  if (isMissing(city)) return 'Not listed';
  return city
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (match, before, letter) => before + letter.toUpperCase())
    .replace(/\bHts\b/, 'Heights');
}

// "Grocery Store- Medium" -> "Grocery Store - Medium", "@Fast Food-Do Not Use" -> "Fast Food - Do Not Use"
// ("Carry-out" is a normal word with a hyphen, so it stays as it is)
export function cleanCategory(category) {
  if (isMissing(category)) return 'Not listed';
  return category
    .replace(/^@/, '')
    .replace(/\s*-\s+/g, ' - ') // a hyphen followed by a space: "Store- Medium"
    .replace(/([a-z])-([A-Z])/g, '$1 - $2') // a hyphen jammed between a word and a capital: "Food-Do"
    .trim();
}

// There are 15 food safety checks. How many of them did this inspection mark "Out of Compliance"?
export function countFailedChecks(inspection) {
  return Object.values(inspection).filter((value) => value === 'Out of Compliance').length;
}

// The names of the 15 check fields, found from the data itself (a field whose value is a compliance answer)
export function getCheckFields(data) {
  const fields = data.flatMap((inspection) =>
    Object.keys(inspection).filter(
      (key) => inspection[key] === 'In Compliance' || inspection[key] === 'Out of Compliance'
    )
  );
  return [...new Set(fields)];
}

// "rodent_and_insects" -> "Rodent and insects". A few field names are cut off in the data, so those get a fuller label.
const CHECK_LABELS = {
  food_protected_from: 'Food protected from contamination',
  food_contact_surfaces_and: 'Food contact surfaces',
};
export function checkLabel(field) {
  if (CHECK_LABELS[field]) return CHECK_LABELS[field];
  const words = field.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// A short word for how an inspection turned out, used for colour AND text so colour is never the only signal
export function resultTone(result) {
  if (isMissing(result)) return 'unknown';
  const text = result.toLowerCase();
  if (text.startsWith('compliant') || text.includes('completed')) return 'good';
  if (text.includes('non-compliant') || text.includes('critical') || text.includes('closed')) return 'bad';
  return 'watch';
}

export function resultPill(result) {
  return `<span class="pill pill-${resultTone(result)}">${escapeHTML(orNotListed(result))}</span>`;
}

/**
 * Group inspections by type of business.
 * Types with fewer than minSize inspections are joined into "Other types",
 * because an average over 1 or 2 inspections says almost nothing.
 *
 * Before: [{ category: 'Restaurant', ... }, { category: 'Ice Cream', ... }, ...]  (150 records)
 * After:  [{ label: 'Fast Food - Chain', count: 29, avgFailed: 0.41, items: [...] }, ...]
 */
export function groupByType(data, minSize = 3) {
  const byType = {};
  data.forEach((inspection) => {
    const type = cleanCategory(inspection.category);
    byType[type] = byType[type] || [];
    byType[type].push(inspection);
  });

  const groups = {};
  Object.keys(byType).forEach((type) => {
    const label = byType[type].length < minSize ? 'Other types' : type;
    groups[label] = (groups[label] || []).concat(byType[type]);
  });

  return Object.keys(groups)
    .map((label) => {
      const items = groups[label];
      const totalFailed = items.reduce((sum, inspection) => sum + countFailedChecks(inspection), 0);
      return {
        label,
        items,
        count: items.length,
        avgFailed: totalFailed / items.length,
      };
    })
    .sort((a, b) => {
      // "Other types" and "Not listed" go last, everything else biggest group first
      const isLast = (group) => (group.label === 'Other types' || group.label === 'Not listed' ? 1 : 0);
      return isLast(a) - isLast(b) || b.count - a.count;
    });
}
