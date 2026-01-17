/**
 * Register this source with @metaxia/scriptures-core.
 */

import { registerSource } from '@metaxia/scriptures-core';
import { sourceInfo, loadVerse, loadChapter } from './source.js';

registerSource({
  ...sourceInfo,
  loadVerse,
  loadChapter,
});
