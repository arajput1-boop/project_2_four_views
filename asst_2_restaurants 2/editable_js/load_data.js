// ============================================
// DATA LOADING
// ============================================
/**
 * Loads the 150 Prince George's County food safety inspections from data.json.
 *
 * Remember: fetch() only works when the page is served (Live Server, or GitHub Pages),
 * not when you double-click index.html.
 */
async function loadData() {
  try {
    // data.json holds 150 Prince George's County food inspections
    const response = await fetch('./data.json');

    // fetch() does not throw on a 404, so check the answer ourselves
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('data.json is not a list of inspections');
    }

    return data;
  } catch (error) {
    console.error('Failed to load data:', error);
    throw new Error('Could not load the inspections. Is the page running in Live Server or on GitHub Pages?');
  }
}

export default loadData;
