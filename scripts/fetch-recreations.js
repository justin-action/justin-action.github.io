#!/usr/bin/env node
// Fetches the "Movie Recreations" Notion database and writes it to
// data/recreations.json for adventures.html to render. Also downloads the
// Original/Recreation photos attached in Notion into images/recreations/<slug>/.
//
// Slug: uses the "slug" field in Notion if you set one, otherwise auto-generates
// one from the Name (e.g. "Sherlock — 221B Baker St" -> "sherlock-221b-baker-st").
// You only need to set it manually if you want to override the auto one.
//
// Setup (one-time):
//   1. Create an integration at https://www.notion.so/my-integrations
//   2. Open the Movie Recreations database in Notion, click "..." > Connections,
//      and add your integration so it can read the database.
//   3. Save your token so you don't have to retype it — create scripts/.env.local
//      (already gitignored) containing:
//        NOTION_TOKEN=secret_xxx
//
// Usage:
//   node scripts/fetch-recreations.js
//   (or, one-off without saving a token: NOTION_TOKEN=secret_xxx node scripts/fetch-recreations.js)
//
// Run this again any time you add/edit rows or swap photos in Notion, then
// commit + push the updated data/recreations.json and any new images.
// Note: if a row's slug already has a downloaded original.jpg/recreation.jpg
// locally, this script won't re-download it — delete the local file first if
// you replaced the photo in Notion and want the new one pulled down.

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '.env.local');
if (!process.env.NOTION_TOKEN && fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = /^\s*NOTION_TOKEN\s*=\s*(.+?)\s*$/.exec(line);
    if (m) process.env.NOTION_TOKEN = m[1];
  }
}

const TOKEN = process.env.NOTION_TOKEN;
const DATA_SOURCE_ID = '327e38c7-0265-80f1-b92a-000bd4ab8cb3';
const DATABASE_ID = '327e38c7-0265-80f1-b92a-000bd4ab8cb3';
const OUT_PATH = path.join(__dirname, '..', 'data', 'recreations.json');

if (!TOKEN) {
  console.error(
    'Missing NOTION_TOKEN.\n\n' +
    'Create an integration at https://www.notion.so/my-integrations, share the\n' +
    'Movie Recreations database with it, then either:\n' +
    '  - run once with:  NOTION_TOKEN=secret_xxx node scripts/fetch-recreations.js\n' +
    '  - or save it so future runs are just `node scripts/fetch-recreations.js`:\n' +
    '      create scripts/.env.local containing:  NOTION_TOKEN=secret_xxx\n'
  );
  process.exit(1);
}

async function queryPage(cursor, useLegacy) {
  const url = useLegacy
    ? `https://api.notion.com/v1/databases/${DATABASE_ID}/query`
    : `https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`;
  const body = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': useLegacy ? '2022-06-28' : '2025-09-03',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function queryAllPages() {
  let results = [];
  let cursor;
  let useLegacy = false;
  let first = true;

  while (true) {
    let res = await queryPage(cursor, useLegacy);
    if (!res.ok && first && !useLegacy) {
      // New data-source endpoint didn't work (older workspace / API version) — fall back.
      useLegacy = true;
      res = await queryPage(cursor, useLegacy);
    }
    first = false;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    results = results.concat(data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

function plainText(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('').trim();
}

function selectOrText(prop) {
  if (!prop) return null;
  if (prop.select) return prop.select.name;
  if (prop.status) return prop.status.name;
  if (Array.isArray(prop.rich_text)) return plainText(prop.rich_text) || null;
  if (Array.isArray(prop.title)) return plainText(prop.title) || null;
  return null;
}

function extractLatLng(prop) {
  if (!prop || prop.type !== 'place' || !prop.place) return { lat: null, lng: null };
  const place = prop.place;
  const lat = place.lat;
  const lng = place.lon ?? place.lng ?? place.longitude;
  return { lat: typeof lat === 'number' ? lat : null, lng: typeof lng === 'number' ? lng : null };
}

function mapPage(page) {
  const p = page.properties;
  const { lat, lng } = extractLatLng(p['location']);

  return {
    id: page.id,
    name: plainText(p['Name']?.title),
    film: plainText(p['Film / Show']?.rich_text) || selectOrText(p['Film / Show']),
    city: selectOrText(p['City']),
    scene: plainText(p['Scene / Moment']?.rich_text),
    releaseYear: typeof p['Release year']?.number === 'number' ? p['Release year'].number : null,
    recreatedYear: typeof p['Recreated year']?.number === 'number' ? p['Recreated year'].number : null,
    notes: plainText(p['Notes']?.rich_text),
    status: selectOrText(p['Status']),
    source: p['Source']?.url || null,
    featured: p['Featured']?.checkbox === true,
    unavailable: p['No longer available']?.checkbox === true,
    lat,
    lng,
    // Explicit slug from Notion, if you ever want to override the auto-generated one below.
    slug: plainText(p['slug']?.rich_text) || plainText(p['Slug']?.rich_text) || null,
  };
}

// "Sherlock — Sherlock Holmes' Home (221B)" -> "sherlock-sherlock-holmes-home-221b"
function slugify(str) {
  return String(str || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Fills in item.slug for any row that didn't set one explicitly in Notion,
// deriving it from the Name so you don't have to type a slug for every row.
// Dedupes against explicit + already-assigned slugs so two similarly-named
// rows don't collide and overwrite each other's image folder.
function assignSlugs(items) {
  const used = new Set(items.map(i => i.slug).filter(Boolean));
  items.forEach(item => {
    if (item.slug) return;
    const base = slugify(item.name) || `recreation-${item.id.slice(0, 8)}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}-${n++}`;
    used.add(candidate);
    item.slug = candidate;
  });
}

// Pulls the first file out of a Notion "files" property and figures out a
// sane extension from its real filename (falls back to the URL, then jpg).
function getFileInfo(prop) {
  if (!prop || !Array.isArray(prop.files) || !prop.files.length) return null;
  const f = prop.files[0];
  const url = f.type === 'external' ? f.external?.url : f.file?.url;
  if (!url) return null;

  const nameNoQuery = (f.name || '').split('?')[0];
  let ext = path.extname(nameNoQuery).replace('.', '').toLowerCase();
  if (!ext) {
    const urlNoQuery = url.split('?')[0];
    ext = path.extname(urlNoQuery).replace('.', '').toLowerCase();
  }
  if (!ext) ext = 'jpg';

  return { url, ext };
}

// Downloads a Notion file property to images/recreations/<slug>/<kind>.<ext>
// (skipping the download if that file already exists locally) and returns
// the site-relative path to use in the JSON, or null if there's nothing to fetch.
async function downloadImage(prop, slug, kind) {
  const info = getFileInfo(prop);
  if (!info) return null;

  const relPath = `images/recreations/${slug}/${kind}.${info.ext}`;
  const absPath = path.join(__dirname, '..', relPath);

  if (fs.existsSync(absPath)) return relPath;

  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    const res = await fetch(info.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(absPath, buf);
    console.log(`Downloaded ${relPath}`);
    return relPath;
  } catch (err) {
    console.warn(`Could not download ${kind} photo for "${slug}": ${err.message}`);
    return null;
  }
}

(async () => {
  console.log('Fetching Movie Recreations from Notion...');
  const pages = await queryAllPages();

  const items = pages.map(mapPage);
  assignSlugs(items);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.originalImage = await downloadImage(pages[i].properties['Original'], item.slug, 'original');
    item.recreationImage = await downloadImage(pages[i].properties['Recreation'], item.slug, 'recreation');
  }

  // Featured rows sort first (stable — otherwise keeps Notion's own order).
  items.sort((a, b) => (b.featured === true) - (a.featured === true));

  const missingLocation = items.filter(i => i.lat == null || i.lng == null);
  const missingPhotos = items.filter(i => !i.originalImage || !i.recreationImage);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(items, null, 2) + '\n');

  console.log(`Wrote ${items.length} recreation(s) to ${path.relative(process.cwd(), OUT_PATH)}`);
  if (missingLocation.length) {
    console.warn(
      `${missingLocation.length} row(s) missing lat/lng (won't get a map pin): ` +
      missingLocation.map(i => i.name || i.id).join(', ')
    );
  }
  if (missingPhotos.length) {
    console.warn(
      `${missingPhotos.length} row(s) missing an Original or Recreation upload in Notion: ` +
      missingPhotos.map(i => i.name || i.id).join(', ')
    );
  }
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
