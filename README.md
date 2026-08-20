# @metaxia/scriptures-source-stepbible-tagnt-tr

Complete Textus Receptus (Greek) data from STEPBible TAGNT for [@metaxia/scriptures](https://github.com/metaxiamultimedia/scriptures-js).

## Why This Package?

This package processes the upstream STEPBible TAGNT data directly, properly handling alternate versification markers that other sources may miss. This ensures a **complete** Textus Receptus including:

- **John 7:53** - Start of Pericope Adulterae
- **Romans 16:25-27** - The Doxology
- **2 Corinthians 13:13-14** - Benediction
- **Philippians 1:16-17** - KJV versification
- **1 John 5:7** - Comma Johanneum (full TR text)
- All other TR-specific verses (Matt 17:21, 18:11, Acts 8:37, etc.)

## Source

- **Upstream Data:** [STEPBible-Data TAGNT](https://github.com/STEPBible/STEPBible-Data)
- **Original Creators:** Tyndale House, Cambridge
- **Data License:** CC BY 4.0

## Installation

```bash
npm install @metaxia/scriptures @metaxia/scriptures-source-stepbible-tagnt-tr
```

## Usage

### Auto-Registration

```typescript
import '@metaxia/scriptures-source-stepbible-tagnt-tr';
import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('John', 1, 1, { edition: 'stepbible-tagnt-tr' });
console.log(verse.text);
// "Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν, καὶ θεὸς ἦν ὁ λόγος."
```

### Lazy Loading

```typescript
import '@metaxia/scriptures-source-stepbible-tagnt-tr/register';
import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('John', 1, 1, { edition: 'stepbible-tagnt-tr' });
```

## Contents

- **Edition**: stepbible-tagnt-tr
- **Language**: Greek (polytonic with full diacritics and iota subscripts)
- **Books**: 27 (Matthew-Revelation)
- **Features**:
  - Robinson morphological tagging
  - Strong's concordance numbers
  - Word-level English glosses
  - Gematria values (standard, ordinal, reduced)
  - Complete TR text with all verses

## Data Format

```json
{
  "text": "Ἐν ἀρχῇ ἦν ὁ λόγος...",
  "words": [
    {
      "position": 1,
      "text": "Ἐν",
      "lemma": ["G1722"],
      "strongs": "G1722",
      "morph": "robinson:PREP",
      "translation": "In",
      "gematria": { "standard": 55, "ordinal": 12, "reduced": 3 }
    }
  ],
  "gematria": { "standard": 3627, "ordinal": 287, "reduced": 44 }
}
```

## Versification Handling

The upstream TAGNT uses special markers for verses with different versification across manuscript traditions:

- `{chapter.verse}` - Alternate manuscript tradition location
- `[chapter.verse]` - KJV versification difference

This package correctly interprets these markers to place TR words at their proper KJV verse locations.

## Development

### Import Data

```bash
npm run import
```

This downloads the TAGNT files from STEPBible GitHub and processes them into JSON.

### Run Tests

```bash
npm test
```

Tests verify:
- All TR-specific verses are present
- Polytonic Greek is preserved (accents, iota subscripts)
- Gematria calculations are correct
- Verse counts match expected TR totals

## License

This package is dual-licensed:

- **Code (TypeScript/JavaScript)**: MIT License
- **Data (annotations)**: CC BY 4.0 (STEPBible / Tyndale House)
- **Greek Text (TR/Scrivener 1894)**: Public Domain

### Required Attribution

When using this data, you must include:

> Scripture morphological tagging from [STEP Bible](https://www.stepbible.org) by Tyndale House, Cambridge. Licensed under CC BY 4.0.

## See Also

- [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data) - Original TAGNT data
- [@metaxia/scriptures](https://github.com/metaxiamultimedia/scriptures-js) - Main scriptures library
- [@metaxia/scriptures-core](https://github.com/metaxiamultimedia/scriptures-js-core) - Core types and utilities
