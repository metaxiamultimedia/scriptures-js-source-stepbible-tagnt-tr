/**
 * Tests for the import script parsing logic.
 */

import { describe, it, expect } from 'vitest';

// Greek letter to numeric value mappings for gematria
const GREEK_VALUES: Record<string, number> = {
  'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ϛ': 6, 'ζ': 7, 'η': 8, 'θ': 9,
  'ι': 10, 'κ': 20, 'λ': 30, 'μ': 40, 'ν': 50, 'ξ': 60, 'ο': 70, 'π': 80, 'ϟ': 90,
  'ρ': 100, 'σ': 200, 'ς': 200, 'τ': 300, 'υ': 400, 'φ': 500, 'χ': 600, 'ψ': 700, 'ω': 800, 'ϡ': 900,
};

const GREEK_ORDINAL: Record<string, number> = {
  'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ζ': 6, 'η': 7, 'θ': 8,
  'ι': 9, 'κ': 10, 'λ': 11, 'μ': 12, 'ν': 13, 'ξ': 14, 'ο': 15, 'π': 16,
  'ρ': 17, 'σ': 18, 'ς': 18, 'τ': 19, 'υ': 20, 'φ': 21, 'χ': 22, 'ψ': 23, 'ω': 24,
};

function normalizeGreek(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\u0345/g, 'ι')  // Preserve iota subscript as regular iota
    .replace(/[\u0300-\u036f]/g, '')  // Remove other combining marks
    .toLowerCase();
}

function computeGreek(text: string): Record<string, number> {
  const normalized = normalizeGreek(text);
  let standard = 0;
  let ordinal = 0;
  let reduced = 0;

  for (const char of normalized) {
    const stdVal = GREEK_VALUES[char];
    const ordVal = GREEK_ORDINAL[char];
    if (stdVal !== undefined) {
      standard += stdVal;
    }
    if (ordVal !== undefined) {
      ordinal += ordVal;
      let val = ordVal;
      while (val > 9) {
        let sum = 0;
        while (val > 0) {
          sum += val % 10;
          val = Math.floor(val / 10);
        }
        val = sum;
      }
      reduced += val;
    }
  }

  return { standard, ordinal, reduced };
}

/**
 * Parse TAGNT reference with alternate versification handling.
 */
function parseReference(ref: string): {
  book: string;
  chapter: number;
  verse: number;
  wordNum: number;
  type: string;
} | null {
  const match = ref.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\{(\d+)\.(\d+)\})?(?:\[(\d+)\.(\d+)\])?#(\d+)=(.+)$/);
  if (!match) return null;

  const [, book, ch, vs, altCh, altVs, kjvCh, kjvVs, wordNum, type] = match;

  let chapter = parseInt(ch, 10);
  let verse = parseInt(vs, 10);

  // For TR (K) readings, prefer {} alternate versification, then [] KJV versification
  if (type.includes('K') || type.toLowerCase().includes('k')) {
    if (altCh && altVs) {
      chapter = parseInt(altCh, 10);
      verse = parseInt(altVs, 10);
    } else if (kjvCh && kjvVs) {
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

describe('TAGNT reference parsing', () => {
  it('should parse standard reference format', () => {
    const result = parseReference('Mat.1.1#01=NKO');
    expect(result).toEqual({
      book: 'Mat',
      chapter: 1,
      verse: 1,
      wordNum: 1,
      type: 'NKO',
    });
  });

  it('should parse multi-digit values', () => {
    const result = parseReference('Rev.22.21#15=NKO');
    expect(result).toEqual({
      book: 'Rev',
      chapter: 22,
      verse: 21,
      wordNum: 15,
      type: 'NKO',
    });
  });

  it('should handle {} alternate versification for TR words', () => {
    // John 7:53 is marked as {8.1} in TAGNT - for TR, use the alternate verse
    const result = parseReference('Jhn.7.53{8.1}#01=K(O)');
    expect(result).toEqual({
      book: 'Jhn',
      chapter: 8,
      verse: 1,
      wordNum: 1,
      type: 'K(O)',
    });
  });

  it('should handle [] KJV versification', () => {
    // Philippians 1:16 in NRSV is 1:17 in KJV
    const result = parseReference('Php.1.16[1.17]#01=NKO');
    expect(result).toEqual({
      book: 'Php',
      chapter: 1,
      verse: 17,
      wordNum: 1,
      type: 'NKO',
    });
  });

  it('should handle Romans doxology versification', () => {
    // Romans 16:25 might be marked as {14.24} in some traditions
    const result = parseReference('Rom.16.25{14.24}#01=K(O)');
    expect(result).toEqual({
      book: 'Rom',
      chapter: 14,
      verse: 24,
      wordNum: 1,
      type: 'K(O)',
    });
  });

  it('should return null for invalid format', () => {
    expect(parseReference('invalid')).toBeNull();
    expect(parseReference('Mat.1.1')).toBeNull();
    expect(parseReference('Mat.1.1#01')).toBeNull();
  });
});

describe('TR word type detection', () => {
  function isTrWord(type: string): boolean {
    return type.includes('K') || type.includes('k');
  }

  it('should identify TR words', () => {
    expect(isTrWord('NKO')).toBe(true);
    expect(isTrWord('K')).toBe(true);
    expect(isTrWord('NK')).toBe(true);
    expect(isTrWord('KO')).toBe(true);
    expect(isTrWord('K(O)')).toBe(true);
    expect(isTrWord('N(K)(O)')).toBe(true);
    expect(isTrWord('nKo')).toBe(true);
    expect(isTrWord('(k)')).toBe(true);
  });

  it('should exclude non-TR words', () => {
    expect(isTrWord('NO')).toBe(false);
    expect(isTrWord('N')).toBe(false);
    expect(isTrWord('O')).toBe(false);
    expect(isTrWord('N(O)')).toBe(false);
  });
});

describe('dStrongs parsing', () => {
  function parseDStrongs(dStrongs: string) {
    const match = dStrongs.match(/^G(\d+)[A-Z]?=(.+)$/);
    if (!match) return null;
    const [, num, morph] = match;
    return { strongs: `G${parseInt(num)}`, morph: `robinson:${morph}` };
  }

  it('should parse Strong\'s number and morphology', () => {
    const result = parseDStrongs('G0976=N-NSF');
    expect(result).toEqual({ strongs: 'G976', morph: 'robinson:N-NSF' });
  });

  it('should normalize leading zeros', () => {
    const result = parseDStrongs('G00001=CONJ');
    expect(result).toEqual({ strongs: 'G1', morph: 'robinson:CONJ' });
  });

  it('should handle sense suffix letters', () => {
    expect(parseDStrongs('G2424G=N-NSM-P')).toEqual({ strongs: 'G2424', morph: 'robinson:N-NSM-P' });
    expect(parseDStrongs('G3754H=CONJ')).toEqual({ strongs: 'G3754', morph: 'robinson:CONJ' });
  });
});

describe('Greek text extraction', () => {
  function extractGreek(greekCol: string): string {
    const match = greekCol.match(/^([^\(]+)/);
    return match ? match[1].trim() : greekCol.trim();
  }

  it('should extract Greek text from column with transliteration', () => {
    expect(extractGreek('Βίβλος (Biblos)')).toBe('Βίβλος');
    expect(extractGreek('λόγος (logos)')).toBe('λόγος');
  });

  it('should handle Greek text without transliteration', () => {
    expect(extractGreek('Βίβλος')).toBe('Βίβλος');
  });

  it('should preserve accents and diacritics', () => {
    expect(extractGreek('ἀρχῇ (archē)')).toBe('ἀρχῇ');
    expect(extractGreek('τῷ (tō)')).toBe('τῷ');
  });
});

describe('gematria with diacritics', () => {
  it('should calculate gematria for accented Greek', () => {
    const result = computeGreek('λόγος');
    expect(result.standard).toBe(373);  // λ=30, ο=70, γ=3, ο=70, σ=200
  });

  it('should handle iota subscript', () => {
    // τῷ = tau + omega with iota subscript
    // τ=300, ω=800, ι=10 (subscript) = 1110
    const result = computeGreek('τῷ');
    expect(result.standard).toBe(1110);  // 300 + 800 + 10
  });

  it('should include iota subscript in gematria (ᾳ, ῃ, ῳ)', () => {
    // ἀρχῇ has eta with iota subscript: α=1, ρ=100, χ=600, η=8, ι=10 = 719
    const result = computeGreek('ἀρχῇ');
    expect(result.standard).toBe(719);

    // Without iota subscript would be 709
    const withoutSubscript = computeGreek('ἀρχη');
    expect(withoutSubscript.standard).toBe(709);

    // Difference should be exactly iota value (10)
    expect(result.standard - withoutSubscript.standard).toBe(10);
  });

  it('should match accented and unaccented gematria', () => {
    const withAccent = computeGreek('λόγος');
    const without = computeGreek('λογος');
    expect(withAccent.standard).toBe(without.standard);
  });
});

describe('TAGNT file format', () => {
  it('should skip header lines correctly', () => {
    const headerPatterns = [
      'TAGNT Mat-Jhn - Translators Amalgamated',
      '(This is saved as 2  files',
      '=================================',
      'Introduction & Abbreviations at:',
      '\tData created by www.STEPBible.org',
      '# Mat.1.1',  // Comment/summary line
      'Word & Type\tGreek\tEnglish',  // Column header
    ];

    for (const line of headerPatterns) {
      const isDataLine =
        line.trim() &&
        !line.startsWith('#') &&
        !line.startsWith('=') &&
        !line.startsWith('Word & Type') &&
        !line.startsWith('TAGNT') &&
        !line.startsWith('(This is') &&
        !line.startsWith('Introduction') &&
        !line.startsWith('\t') &&
        line.includes('\t') &&
        /^[A-Za-z0-9]+\.\d+\.\d+/.test(line);

      expect(isDataLine).toBe(false);
    }
  });

  it('should recognize data lines', () => {
    const dataLine = 'Mat.1.1#01=NKO\tΒίβλος (Biblos)\t[The] book\tG0976=N-NSF';
    const isDataLine =
      dataLine.trim() &&
      !dataLine.startsWith('#') &&
      !dataLine.startsWith('=') &&
      dataLine.includes('\t') &&
      /^[A-Za-z0-9]+\.\d+\.\d+/.test(dataLine);

    expect(isDataLine).toBe(true);
  });
});
