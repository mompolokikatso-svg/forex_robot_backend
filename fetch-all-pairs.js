#!/usr/bin/env node
/**
 * Fetch the complete forex pair list from FCS /forex/list
 * Merge into symbols.json alongside the curated commodities/crypto/indices/stocks
 */

const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(process.env.HOME, '.fcs_key'), 'utf8').trim();
const URL = 'https://api-v4.fcsapi.com/forex/list?access_key=' + encodeURIComponent(KEY);

async function main() {
  console.log('Fetching forex list from FCS...');
  const res = await fetch(URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);

  const json = await res.json();
  if (json.status === false) {
    throw new Error('FCS error: ' + (json.msg || json.code));
  }

  const raw = json.response || [];
  console.log('  Raw entries:', raw.length);

  // Extract unique symbols
  const seen = new Set();
  const forex = [];

  for (const item of raw) {
    const sym = item?.profile?.symbol || '';
    const name = item?.profile?.name || '';
    const clean = sym.replace(/[^A-Z]/g, '');
    if (!clean || clean.length < 5 || clean.length > 8) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    forex.push({ symbol: clean, name });
  }

  forex.sort((a, b) => a.symbol.localeCompare(b.symbol));
  console.log('  Unique forex pairs:', forex.length);

  // Load existing symbols.json to preserve other categories
  const existingPath = path.join(process.env.HOME, 'forex-robot-backend', 'symbols.json');
  let existing = {
    forex: [], commodities: [], crypto: [], indices: [], stocks: []
  };
  if (fs.existsSync(existingPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    } catch (e) {
      console.warn('  Could not parse existing symbols.json, starting fresh');
    }
  }

  // Build new symbols.json: fresh forex list + preserved other categories
  const output = {
    fetchedAt: new Date().toISOString(),
    version: 2,
    source: 'FCS /forex/list + curated',
    forex,
    commodities: existing.commodities || [],
    crypto: existing.crypto || [],
    indices: existing.indices || [],
    stocks: existing.stocks || []
  };

  const total = forex.length +
    output.commodities.length +
    output.crypto.length +
    output.indices.length +
    output.stocks.length;

  fs.writeFileSync(existingPath, JSON.stringify(output, null, 2));

  console.log('');
  console.log('  forex:       ' + forex.length);
  console.log('  commodities: ' + output.commodities.length);
  console.log('  crypto:      ' + output.crypto.length);
  console.log('  indices:     ' + output.indices.length);
  console.log('  stocks:      ' + output.stocks.length);
  console.log('  ─────────────────');
  console.log('  total:       ' + total);
  console.log('');
  console.log('  → symbols.json written (' + (fs.statSync(existingPath).size / 1024).toFixed(1) + ' KB)');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
