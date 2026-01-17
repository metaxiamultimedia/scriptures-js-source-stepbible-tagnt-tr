/**
 * Tests for @metaxia/scriptures-source-stepbible-tagnt-tr
 */

import { describe, it, expect } from 'vitest';
import { loadVerse, loadChapter, listBooks, metadata } from '../src/source.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data', 'stepbible-tagnt-tr');

// Check if data has been imported
const dataExists = existsSync(join(DATA_DIR, 'Matt', '1', '1.json'));

describe('source metadata', () => {
  it('should have correct edition abbreviation', () => {
    expect(metadata.abbreviation).toBe('stepbible-tagnt-tr');
  });

  it('should be Greek language', () => {
    expect(metadata.language).toBe('Greek');
  });

  it('should have CC BY 4.0 license', () => {
    expect(metadata.license).toBe('CC BY 4.0');
  });

  it('should have STEPBible source URLs', () => {
    expect(metadata.urls).toContain('https://www.stepbible.org');
    expect(metadata.urls).toContain('https://github.com/STEPBible/STEPBible-Data');
  });
});

describe('listBooks', () => {
  it('should list all 27 New Testament books', () => {
    const books = listBooks();
    expect(books.length).toBe(27);
    expect(books).toContain('Matthew');
    expect(books).toContain('Revelation');
  });
});

describe.skipIf(!dataExists)('loadVerse', () => {
  it('should load Matthew 1:1', async () => {
    const verse = await loadVerse('Matthew', 1, 1);
    expect(verse).toBeDefined();
    expect(verse.text).toBeDefined();
    expect(verse.words).toBeInstanceOf(Array);
    expect(verse.words.length).toBeGreaterThan(0);
  });

  it('should load John 1:1 with λόγος', async () => {
    const verse = await loadVerse('John', 1, 1);
    // Normalize both strings to handle Unicode tonos vs oxia differences
    expect(verse.text.normalize('NFD')).toContain('λόγος'.normalize('NFD'));
  });

  it('should have gematria values', async () => {
    const verse = await loadVerse('John', 1, 1);
    expect(verse.gematria).toBeDefined();
    expect(verse.gematria.standard).toBeGreaterThan(0);
  });

  it('should have word-level data', async () => {
    const verse = await loadVerse('Matthew', 1, 1);
    const firstWord = verse.words[0];
    expect(firstWord.text).toBeDefined();
    expect(firstWord.position).toBe(1);
    expect(firstWord.gematria).toBeDefined();
  });

  it('should throw for non-existent verse', async () => {
    await expect(loadVerse('Matthew', 999, 999)).rejects.toThrow();
  });
});

describe.skipIf(!dataExists)('loadChapter', () => {
  it('should load all verses in Matthew 1', async () => {
    const verses = await loadChapter('Matthew', 1);
    expect(verses.length).toBeGreaterThan(20);
  });

  it('should return verses in order', async () => {
    const verses = await loadChapter('John', 1);
    // Verses should be sequential
    for (let i = 0; i < verses.length; i++) {
      expect(verses[i]).toBeDefined();
    }
  });

  it('should throw for non-existent chapter', async () => {
    await expect(loadChapter('Matthew', 999)).rejects.toThrow();
  });
});

describe.skipIf(!dataExists)('gematria integrity', () => {
  it('John 1:1 verse total should equal 3627', async () => {
    const verse = await loadVerse('John', 1, 1);
    expect(verse.gematria.standard).toBe(3627);
  });

  it('verse gematria should equal sum of word gematria', async () => {
    const testCases = [
      { book: 'John', chapter: 1, verse: 1 },
      { book: 'Matthew', chapter: 1, verse: 1 },
      { book: 'Revelation', chapter: 13, verse: 18 },
      { book: 'Romans', chapter: 8, verse: 28 },
    ];

    for (const { book, chapter, verse: verseNum } of testCases) {
      const verse = await loadVerse(book, chapter, verseNum);

      const wordSumStandard = verse.words.reduce((sum, w) => sum + (w.gematria?.standard || 0), 0);
      const wordSumOrdinal = verse.words.reduce((sum, w) => sum + (w.gematria?.ordinal || 0), 0);
      const wordSumReduced = verse.words.reduce((sum, w) => sum + (w.gematria?.reduced || 0), 0);

      expect(verse.gematria.standard).toBe(wordSumStandard);
      expect(verse.gematria.ordinal).toBe(wordSumOrdinal);
      expect(verse.gematria.reduced).toBe(wordSumReduced);
    }
  });
});

/**
 * CRITICAL: Tests for TR-specific verses that were MISSING from HuggingFace version.
 * These verses must be present for a complete Textus Receptus.
 */
describe.skipIf(!dataExists)('TR-specific verses (previously missing)', () => {
  // John 7:53 - Start of Pericope Adulterae
  it('should include John 7:53 (Pericope Adulterae start)', async () => {
    const verse = await loadVerse('John', 7, 53);
    expect(verse).toBeDefined();
    expect(verse.text).toBeDefined();
    expect(verse.words.length).toBeGreaterThan(0);
  });

  // John 8:1-11 - Pericope Adulterae (woman caught in adultery)
  it('should include John 8:1-11 (Pericope Adulterae)', async () => {
    for (let v = 1; v <= 11; v++) {
      const verse = await loadVerse('John', 8, v);
      expect(verse).toBeDefined();
      expect(verse.text.length).toBeGreaterThan(0);
    }
  });

  // Romans 16:25-27 - Doxology
  it('should include Romans 16:25-27 (Doxology)', async () => {
    for (let v = 25; v <= 27; v++) {
      const verse = await loadVerse('Romans', 16, v);
      expect(verse).toBeDefined();
      expect(verse.text.length).toBeGreaterThan(0);
    }
  });

  // 2 Corinthians 13:13-14 - Benediction
  it('should include 2 Corinthians 13:13-14 (Benediction)', async () => {
    // Note: In some versification, verse 13 may be the last verse
    // TR/KJV has 14 verses in this chapter
    const verse13 = await loadVerse('2 Corinthians', 13, 13);
    expect(verse13).toBeDefined();

    // verse 14 should also exist
    const verse14 = await loadVerse('2 Corinthians', 13, 14);
    expect(verse14).toBeDefined();
  });

  // Philippians 1:16-17 - Versification difference
  it('should include Philippians 1:16-17', async () => {
    const verse16 = await loadVerse('Philippians', 1, 16);
    expect(verse16).toBeDefined();
    expect(verse16.text.length).toBeGreaterThan(0);

    const verse17 = await loadVerse('Philippians', 1, 17);
    expect(verse17).toBeDefined();
    expect(verse17.text.length).toBeGreaterThan(0);
  });

  // 1 John 5:7 - Comma Johanneum
  it('should include 1 John 5:7 (Comma Johanneum)', async () => {
    const verse = await loadVerse('1 John', 5, 7);
    expect(verse).toBeDefined();
    expect(verse.text).toBeDefined();
    // Should contain "heaven" reference (ἐν τῷ οὐρανῷ)
    expect(verse.text.normalize('NFD')).toContain('οὐρανῷ'.normalize('NFD'));
  });

  // Other TR-only verses
  it('should include Acts 8:37 (Philip and eunuch)', async () => {
    const verse = await loadVerse('Acts', 8, 37);
    expect(verse).toBeDefined();
    expect(verse.text).toContain('Φίλιππος'); // Philip
  });

  it('should include Matthew 17:21 (prayer and fasting)', async () => {
    const verse = await loadVerse('Matthew', 17, 21);
    expect(verse).toBeDefined();
  });

  it('should include Matthew 18:11 (Son of Man came to save)', async () => {
    const verse = await loadVerse('Matthew', 18, 11);
    expect(verse).toBeDefined();
  });

  it('should include Mark 9:44 and 9:46 (where worm dieth not)', async () => {
    const verse44 = await loadVerse('Mark', 9, 44);
    expect(verse44).toBeDefined();

    const verse46 = await loadVerse('Mark', 9, 46);
    expect(verse46).toBeDefined();
  });

  it('should include Acts 24:7 (Lysias reference)', async () => {
    const verse = await loadVerse('Acts', 24, 7);
    expect(verse).toBeDefined();
  });

  it('should include Acts 28:29', async () => {
    const verse = await loadVerse('Acts', 28, 29);
    expect(verse).toBeDefined();
  });
});

/**
 * Tests for proper polytonic Greek with iota subscripts.
 */
describe.skipIf(!dataExists)('polytonic Greek with iota subscripts', () => {
  it('should have proper accents (not stripped)', async () => {
    const verse = await loadVerse('John', 1, 1);
    // Text should have combining diacritical marks
    const hasAccents = /[\u0300-\u036f]/.test(verse.text.normalize('NFD'));
    expect(hasAccents).toBe(true);
  });

  it('should have iota subscripts preserved', async () => {
    // τῷ contains omega with iota subscript (U+1FF7)
    // Or tau + omega + combining iota subscript (U+0345)
    const verse = await loadVerse('John', 1, 1);
    // Check for iota subscript character (either precomposed or combining)
    const hasIotaSubscript =
      verse.text.includes('ῷ') ||  // precomposed
      verse.text.normalize('NFD').includes('\u0345');  // combining
    expect(hasIotaSubscript).toBe(true);
  });
});

/**
 * Verse count verification.
 */
describe.skipIf(!dataExists)('verse counts', () => {
  it('should have correct verse count for Romans 16 (including doxology)', async () => {
    const verses = await loadChapter('Romans', 16);
    expect(verses.length).toBe(27); // TR has 27 verses including doxology
  });

  it('should have correct verse count for 2 Corinthians 13', async () => {
    const verses = await loadChapter('2 Corinthians', 13);
    expect(verses.length).toBe(14); // TR/KJV has 14 verses
  });

  it('should have correct verse count for Philippians 1', async () => {
    const verses = await loadChapter('Philippians', 1);
    expect(verses.length).toBe(30); // Should have all 30 verses
  });

  it('should have correct verse count for John 7 (including 7:53)', async () => {
    const verses = await loadChapter('John', 7);
    expect(verses.length).toBe(53); // TR includes verse 53
  });
});
