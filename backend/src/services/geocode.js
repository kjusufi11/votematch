// src/services/geocode.js
// Resolves ZIP code to state + congressional district
// Uses Census Bureau geocoding API — completely free, no key needed
// Docs: https://geocoding.geo.census.gov/

const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 * 7 }); // ZIP->district rarely changes, cache 7 days

// ZIP code to state abbreviation lookup (built-in, no API needed)
const ZIP_STATE = require('./zipState');

async function getDistrictFromZip(zip) {
  const cached = cache.get(zip);
  if (cached) return cached;

  // First get state from our built-in ZIP lookup
  const state = ZIP_STATE[zip];

  try {
    // Use Census geocoding to get precise congressional district
    const { data } = await axios.get(
      'https://geocoding.geo.census.gov/geocoder/geographies/address',
      {
        params: {
          street: '',
          zip,
          benchmark: 'Public_AR_Current',
          vintage: 'Current_Current',
          layers: 'Congressional Districts',
          format: 'json',
        },
        timeout: 10000,
      }
    );

    const results = data?.result?.addressMatches;
    if (results?.length) {
      const geo = results[0].geographies?.['Congressional Districts']?.[0];
      const districtNum = geo ? parseInt(geo.DISTRICT) : null;
      const stateCode = results[0].addressComponents?.state || state;

      const result = { state: stateCode, district: districtNum, zip };
      cache.set(zip, result);
      return result;
    }
  } catch (err) {
    console.warn(`Census geocoding failed for ${zip}:`, err.message);
  }

  // Fallback: return state only, no district
  return { state: state || null, district: null, zip };
}

module.exports = { getDistrictFromZip };
