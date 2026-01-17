/**
 * Import script for STEPBible TAGNT Textus Receptus (Greek NT) data.
 *
 * Downloads TAGNT files directly from STEPBible GitHub, filters for TR (K) words,
 * and properly handles alternate versification markers.
 *
 * Key improvements over HuggingFace version:
 * - Handles {} alternate manuscript locations (e.g., John 7:53 as {8.1})
 * - Handles [] KJV versification differences (e.g., Phil 1:16 as [1.17])
 * - Preserves complete TR text including Rom 16:25-27, 2 Cor 13:13-14, etc.
 *
 * Usage: npx tsx scripts/import.ts
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeGreek } from '@metaxia/scriptures-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const TAGNT_URLS = [
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
];

const SOURCE_DIR = join(ROOT_DIR, 'source');
const DATA_DIR = join(ROOT_DIR, 'data', 'stepbible-tagnt-tr');

// Book mapping from TAGNT abbreviations to OSIS
const BOOK_MAP: Record<string, string> = {
  'Mat': 'Matt', 'Mrk': 'Mark', 'Luk': 'Luke', 'Jhn': 'John',
  'Act': 'Acts', 'Rom': 'Rom', '1Co': '1Cor', '2Co': '2Cor',
  'Gal': 'Gal', 'Eph': 'Eph', 'Php': 'Phil', 'Col': 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim',
  'Tit': 'Titus', 'Phm': 'Phlm', 'Heb': 'Heb',
  'Jas': 'Jas', '1Pe': '1Pet', '2Pe': '2Pet',
  '1Jn': '1John', '2Jn': '2John', '3Jn': '3John',
  'Jud': 'Jude', 'Rev': 'Rev',
};

interface WordEntry {
  position: number;
  text: string;
  lemma: string[] | null;
  morph: string | null;
  strongs: string | null;
  translation: string | null;
  metadata: Record<string, unknown>;
  gematria: Record<string, number>;
}

interface VerseData {
  text: string;
  words: WordEntry[];
  gematria: Record<string, number>;
}

interface ParsedWord {
  book: string;
  chapter: number;
  verse: number;
  wordNum: number;
  type: string;
  greek: string;
  translation: string;
  strongs: string;
  morph: string;
  gloss: string;
  editions: string;
}

/**
 * Parse verse reference handling alternate versification.
 * Examples:
 *   Mat.1.1#01=NKO -> { book: 'Mat', chapter: 1, verse: 1, wordNum: 1, type: 'NKO' }
 *   Jhn.7.53{8.1}#01=K(O) -> { book: 'Jhn', chapter: 8, verse: 1, wordNum: 1, type: 'K(O)' } (for TR)
 *   Php.1.16[1.17]#01=NKO -> { book: 'Php', chapter: 1, verse: 17, wordNum: 1, type: 'NKO' } (KJV versification)
 */
function parseReference(ref: string): { book: string; chapter: number; verse: number; wordNum: number; type: string } | null {
  // Pattern: Book.Chapter.Verse{altVerse}[kjvVerse]#WordNum=Type
  const match = ref.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\{(\d+)\.(\d+)\})?(?:\[(\d+)\.(\d+)\])?#(\d+)=(.+)$/);
  if (!match) return null;

  const [, book, ch, vs, altCh, altVs, kjvCh, kjvVs, wordNum, type] = match;

  // For TR (K) readings, prefer {} alternate versification, then [] KJV versification
  let chapter = parseInt(ch, 10);
  let verse = parseInt(vs, 10);

  // If this is a TR word and has alternate versification, use it
  if (type.includes('K') || type.toLowerCase().includes('k')) {
    if (altCh && altVs) {
      // Use curly brace alternate (manuscript tradition location)
      chapter = parseInt(altCh, 10);
      verse = parseInt(altVs, 10);
    } else if (kjvCh && kjvVs) {
      // Use square bracket KJV versification
      chapter = parseInt(kjvCh, 10);
      verse = parseInt(kjvVs, 10);
    }
  }

  return {
    book,
    chapter,
    verse,
    wordNum: parseInt(wordNum, 10),
    type,
  };
}

/**
 * Check if word type indicates TR (Textus Receptus) inclusion.
 * K = TR word, k = minor TR variant
 */
function isTrWord(type: string): boolean {
  return type.includes('K') || type.includes('k');
}

/**
 * Extract Greek text from the Greek column (remove transliteration).
 * Format: "Βίβλος (Biblos)" -> "Βίβλος"
 */
function extractGreek(greekCol: string): string {
  const match = greekCol.match(/^([^\(]+)/);
  return match ? match[1].trim() : greekCol.trim();
}

/**
 * Parse Strong's and morphology from the combined column.
 * Format: "G0976=N-NSF" -> { strongs: 'G0976', morph: 'N-NSF' }
 */
function parseStrongsAndMorph(combined: string): { strongs: string; morph: string } {
  const [strongs, morph] = combined.split('=');
  return {
    strongs: strongs?.trim() || '',
    morph: morph?.trim() || '',
  };
}

async function downloadFiles(): Promise<string[]> {
  const files: string[] = [];

  for (let i = 0; i < TAGNT_URLS.length; i++) {
    const url = TAGNT_URLS[i];
    const fileName = i === 0 ? 'TAGNT-Mat-Jhn.txt' : 'TAGNT-Act-Rev.txt';
    const filePath = join(SOURCE_DIR, fileName);

    if (existsSync(filePath)) {
      console.log(`  → Using cached: ${fileName}`);
      files.push(filePath);
      continue;
    }

    console.log(`  → Downloading: ${fileName}...`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${fileName}: ${response.status}`);
    }

    const content = await response.text();
    await mkdir(SOURCE_DIR, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
    files.push(filePath);
    console.log(`  ✓ Downloaded: ${fileName}`);
  }

  return files;
}

function parseTagntFile(content: string): Map<string, ParsedWord[]> {
  const verseMap = new Map<string, ParsedWord[]>();
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip header lines, comments, empty lines
    if (!line.trim() || line.startsWith('#') || line.startsWith('=') ||
        line.startsWith('Word & Type') || line.startsWith('TAGNT') ||
        line.startsWith('(This is') || line.startsWith('All the') ||
        line.startsWith('Introduction') || line.startsWith('Spreadsheet') ||
        line.startsWith('\t') || !line.includes('\t')) {
      continue;
    }

    const cols = line.split('\t');
    if (cols.length < 5) continue;

    const refCol = cols[0]?.trim();
    if (!refCol || !refCol.includes('#')) continue;

    const parsed = parseReference(refCol);
    if (!parsed) continue;

    // Filter for TR words only
    if (!isTrWord(parsed.type)) continue;

    const greek = extractGreek(cols[1] || '');
    const translation = cols[2]?.trim() || '';
    const { strongs, morph } = parseStrongsAndMorph(cols[3] || '');
    const gloss = cols[4]?.trim() || '';
    const editions = cols[5]?.trim() || '';

    // Skip if no Greek text
    if (!greek) continue;

    const osisBook = BOOK_MAP[parsed.book];
    if (!osisBook) continue;

    const verseKey = `${osisBook}.${parsed.chapter}.${parsed.verse}`;

    if (!verseMap.has(verseKey)) {
      verseMap.set(verseKey, []);
    }

    verseMap.get(verseKey)!.push({
      book: osisBook,
      chapter: parsed.chapter,
      verse: parsed.verse,
      wordNum: parsed.wordNum,
      type: parsed.type,
      greek,
      translation,
      strongs,
      morph,
      gloss,
      editions,
    });
  }

  return verseMap;
}

async function saveVerse(book: string, chapter: number, verse: number, words: ParsedWord[]): Promise<void> {
  // Sort words by position
  words.sort((a, b) => a.wordNum - b.wordNum);

  const verseDir = join(DATA_DIR, book, String(chapter));
  await mkdir(verseDir, { recursive: true });

  const wordEntries: WordEntry[] = words.map((w, idx) => ({
    position: idx + 1,
    text: w.greek,
    lemma: w.strongs ? [w.strongs] : null,
    morph: w.morph ? `robinson:${w.morph}` : null,
    strongs: w.strongs || null,
    translation: w.translation || null,
    metadata: {},
    gematria: computeGreek(w.greek),
  }));

  // Calculate verse totals
  const totals: Record<string, number> = {};
  for (const entry of wordEntries) {
    for (const [k, v] of Object.entries(entry.gematria)) {
      totals[k] = (totals[k] || 0) + v;
    }
  }

  // Build text with proper punctuation handling
  let text = wordEntries.map(w => w.text).join(' ');
  text = text.replace(/\s+([,.;:!?·])/g, '$1');

  const data: VerseData = {
    text,
    words: wordEntries,
    gematria: totals,
  };

  const filePath = join(verseDir, `${verse}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function saveMetadata(): Promise<void> {
  const metadata = {
    abbreviation: 'stepbible-tagnt-tr',
    name: 'Textus Receptus (STEPBible TAGNT)',
    language: 'Greek',
    license: 'CC BY 4.0',
    source: 'STEPBible',
    urls: [
      'https://www.stepbible.org',
      'https://github.com/STEPBible/STEPBible-Data'
    ],
    attribution: {
      source: 'STEP Bible / Tyndale House Cambridge - CC BY 4.0',
      data: 'Translators Amalgamated Greek NT (TAGNT)',
    },
    filter: 'TR (K) manuscript source only',
    features: [
      'Complete TR text including Rom 16:25-27, 2 Cor 13:13-14, Phil 1:16-17',
      'Proper polytonic Greek with iota subscripts',
      'Robinson morphological tagging',
      'Strong\'s concordance numbers',
      'English translations',
    ],
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    join(DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
}

async function main(): Promise<void> {
  console.log('STEPBible TAGNT Textus Receptus Importer');
  console.log('=========================================\n');

  try {
    const files = await downloadFiles();

    console.log('\n  → Parsing TAGNT files...');

    const allVerses = new Map<string, ParsedWord[]>();

    for (const file of files) {
      console.log(`  → Processing: ${file.split('/').pop()}`);
      const content = await readFile(file, 'utf-8');
      const verseMap = parseTagntFile(content);

      // Merge into allVerses
      for (const [key, words] of verseMap) {
        if (allVerses.has(key)) {
          allVerses.get(key)!.push(...words);
        } else {
          allVerses.set(key, words);
        }
      }
    }

    console.log(`\n  → Found ${allVerses.size} TR verses`);
    console.log('  → Saving verse files...');

    let saved = 0;
    for (const [key, words] of allVerses) {
      const [book, chapter, verse] = key.split('.');
      await saveVerse(book, parseInt(chapter, 10), parseInt(verse, 10), words);
      saved++;

      if (saved % 1000 === 0) {
        console.log(`  → Saved ${saved}/${allVerses.size} verses...`);
      }
    }

    await saveMetadata();

    console.log(`\n✓ Successfully imported ${saved} TR verses to ${DATA_DIR}`);

    // Report on expected TR-specific verses
    console.log('\n  Checking TR-specific verses:');
    const trSpecific = [
      'Matt.17.21', 'Matt.18.11', 'Matt.23.14',
      'Mark.7.16', 'Mark.9.44', 'Mark.9.46', 'Mark.11.26', 'Mark.15.28',
      'Luke.17.36', 'Luke.23.17',
      'John.5.4', 'John.7.53',
      'Acts.8.37', 'Acts.15.34', 'Acts.24.7', 'Acts.28.29',
      'Rom.16.24', 'Rom.16.25', 'Rom.16.26', 'Rom.16.27',
      '1John.5.7',
      '2Cor.13.13', '2Cor.13.14',
      'Phil.1.16', 'Phil.1.17',
    ];

    for (const ref of trSpecific) {
      const status = allVerses.has(ref) ? '✓' : '✗';
      console.log(`    ${status} ${ref}`);
    }

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
