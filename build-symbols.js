#!/usr/bin/env node
/**
 * Build symbols.json from a curated list + optionally from an exported cache.
 *
 * Usage:
 *   node build-symbols.js [path-to-exported-cache.json]
 *
 * The exported cache is optional. If provided, any pair found in it
 * is merged into the symbols list, so users get whatever pairs you've
 * fetched history for.
 */

const fs = require('fs');
const path = require('path');

// ---- Curated base list ----
// This is what every user will see in the picker.
// Covers majors, minors, gold, oil, crypto, and common crosses.
// Add to this list when you want more symbols available.

const BASE = {
  forex: [
    // Majors
    ['EURUSD', 'Euro / U.S. Dollar'],
    ['GBPUSD', 'British Pound / U.S. Dollar'],
    ['USDJPY', 'U.S. Dollar / Japanese Yen'],
    ['USDCHF', 'U.S. Dollar / Swiss Franc'],
    ['USDCAD', 'U.S. Dollar / Canadian Dollar'],
    ['AUDUSD', 'Australian Dollar / U.S. Dollar'],
    ['NZDUSD', 'New Zealand Dollar / U.S. Dollar'],

    // Minors / crosses
    ['EURGBP', 'Euro / British Pound'],
    ['EURJPY', 'Euro / Japanese Yen'],
    ['EURCHF', 'Euro / Swiss Franc'],
    ['EURCAD', 'Euro / Canadian Dollar'],
    ['EURAUD', 'Euro / Australian Dollar'],
    ['EURNZD', 'Euro / New Zealand Dollar'],
    ['GBPJPY', 'British Pound / Japanese Yen'],
    ['GBPCHF', 'British Pound / Swiss Franc'],
    ['GBPCAD', 'British Pound / Canadian Dollar'],
    ['GBPAUD', 'British Pound / Australian Dollar'],
    ['GBPNZD', 'British Pound / New Zealand Dollar'],
    ['AUDJPY', 'Australian Dollar / Japanese Yen'],
    ['AUDCHF', 'Australian Dollar / Swiss Franc'],
    ['AUDCAD', 'Australian Dollar / Canadian Dollar'],
    ['AUDNZD', 'Australian Dollar / New Zealand Dollar'],
    ['NZDJPY', 'New Zealand Dollar / Japanese Yen'],
    ['NZDCHF', 'New Zealand Dollar / Swiss Franc'],
    ['NZDCAD', 'New Zealand Dollar / Canadian Dollar'],
    ['CADJPY', 'Canadian Dollar / Japanese Yen'],
    ['CADCHF', 'Canadian Dollar / Swiss Franc'],
    ['CHFJPY', 'Swiss Franc / Japanese Yen'],

    // Exotics
    ['USDZAR', 'U.S. Dollar / South African Rand'],
    ['USDMXN', 'U.S. Dollar / Mexican Peso'],
    ['USDTRY', 'U.S. Dollar / Turkish Lira'],
    ['USDNOK', 'U.S. Dollar / Norwegian Krone'],
    ['USDSEK', 'U.S. Dollar / Swedish Krona'],
    ['USDSGD', 'U.S. Dollar / Singapore Dollar'],
    ['USDHKD', 'U.S. Dollar / Hong Kong Dollar'],
    ['USDCNH', 'U.S. Dollar / Offshore Chinese Yuan'],
    ['EURTRY', 'Euro / Turkish Lira'],
    ['EURZAR', 'Euro / South African Rand'],
    ['EURPLN', 'Euro / Polish Zloty'],
    ['EURSEK', 'Euro / Swedish Krona'],
    ['EURNOK', 'Euro / Norwegian Krone'],
    ['GBPZAR', 'British Pound / South African Rand'],
    ['GBPSEK', 'British Pound / Swedish Krona'],
    ['GBPNOK', 'British Pound / Norwegian Krone']
  ],

  commodities: [
    ['XAUUSD', 'Gold / U.S. Dollar'],
    ['XAGUSD', 'Silver / U.S. Dollar'],
    ['XPTUSD', 'Platinum / U.S. Dollar'],
    ['XPDUSD', 'Palladium / U.S. Dollar'],
    ['USOIL',  'WTI Crude Oil'],
    ['UKOIL',  'Brent Crude Oil'],
    ['NATGAS', 'Natural Gas'],
    ['COPPER', 'Copper']
  ],

  crypto: [
    ['BTCUSD',  'Bitcoin / U.S. Dollar'],
    ['ETHUSD',  'Ethereum / U.S. Dollar'],
    ['BNBUSD',  'Binance Coin / U.S. Dollar'],
    ['SOLUSD',  'Solana / U.S. Dollar'],
    ['XRPUSD',  'Ripple / U.S. Dollar'],
    ['ADAUSD',  'Cardano / U.S. Dollar'],
    ['DOGEUSD', 'Dogecoin / U.S. Dollar'],
    ['LTCUSD',  'Litecoin / U.S. Dollar']
  ],

  indices: [
    ['SPX500', 'S&P 500'],
    ['NAS100', 'Nasdaq 100'],
    ['US30',   'Dow Jones 30'],
    ['GER40',  'DAX 40'],
    ['UK100',  'FTSE 100'],
    ['JP225',  'Nikkei 225'],
    ['AUS200', 'ASX 200']
  ],

  stocks: [
    // A few US large-caps, for users who trade stocks
    ['AAPL',  'Apple Inc.'],
    ['MSFT',  'Microsoft Corp.'],
    ['GOOGL', 'Alphabet Inc.'],
    ['AMZN',  'Amazon.com Inc.'],
    ['TSLA',  'Tesla Inc.'],
    ['NVDA',  'NVIDIA Corp.'],
    ['META',  'Meta Platforms Inc.'],
    ['NFLX',  'Netflix Inc.']
  ]
};

// ---- Merge exported cache if provided ----

function categorise(symbol) {
  const s = symbol.toUpperCase();
  if (BASE.commodities.some(c => c[0] === s)) return 'commodities';
  if (BASE.crypto.some(c => c[0] === s))      return 'crypto';
  if (BASE.indices.some(c => c[0] === s))     return 'indices';
  if (BASE.stocks.some(c => c[0] === s))      return 'stocks';
  return 'forex';
}

const seenSymbols = new Set();
for (const cat of Object.keys(BASE)) {
  for (const [sym] of BASE[cat]) seenSymbols.add(sym);
}

const merged = {
  forex:       BASE.forex.map(([symbol, name]) => ({ symbol, name })),
  commodities: BASE.commodities.map(([symbol, name]) => ({ symbol, name })),
  crypto:      BASE.crypto.map(([symbol, name]) => ({ symbol, name })),
  indices:     BASE.indices.map(([symbol, name]) => ({ symbol, name })),
  stocks:      BASE.stocks.map(([symbol, name]) => ({ symbol, name }))
};

// If an exported cache file is passed, merge its pairs in
const cachePath = process.argv[2];
if (cachePath && fs.existsSync(cachePath)) {
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const data = JSON.parse(raw);

    // Expected shape: { EURUSD: { M15: {...}, H1: {...} }, ... }
    // Or: { candles: { ... } } etc — be flexible
    const pairs = Object.keys(data).filter(k => /^[A-Z]{5,8}$/.test(k));

    let added = 0;
    for (const pair of pairs) {
      if (seenSymbols.has(pair)) continue;
      const cat = categorise(pair);
      merged[cat].push({ symbol: pair, name: pair });
      seenSymbols.add(pair);
      added++;
    }
    console.log('  merged ' + added + ' pairs from exported cache');
  } catch (e) {
    console.warn('  could not parse cache file: ' + e.message);
  }
}

// ---- Sort alphabetically within each category ----

for (const cat of Object.keys(merged)) {
  merged[cat].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

// ---- Write ----

const output = {
  fetchedAt: new Date().toISOString(),
  version: 1,
  source: 'curated + cache',
  forex:       merged.forex,
  commodities: merged.commodities,
  crypto:      merged.crypto,
  indices:     merged.indices,
  stocks:      merged.stocks
};

const outPath = path.join(process.env.HOME || process.cwd(), 'forex-robot-backend', 'symbols.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const total = merged.forex.length + merged.commodities.length
            + merged.crypto.length + merged.indices.length + merged.stocks.length;

console.log('  forex:       ' + merged.forex.length);
console.log('  commodities: ' + merged.commodities.length);
console.log('  crypto:      ' + merged.crypto.length);
console.log('  indices:     ' + merged.indices.length);
console.log('  stocks:      ' + merged.stocks.length);
console.log('  ─────────────────');
console.log('  total:       ' + total);
console.log('');
console.log('  → ' + outPath + ' (' + (fs.statSync(outPath).size / 1024).toFixed(1) + ' KB)');
