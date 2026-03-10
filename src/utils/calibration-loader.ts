import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CalibrationAnchor } from '../config/prompts.js';

const REF_SET_PATH = path.resolve('data/reference/reference-set.json');

interface ReferenceAd {
  id: string;
  copy_tier: string;
  primary_text: string;
  headline: string;
}

const SCORE_RANGES: Record<string, string> = {
  strong: '8.5-10',
  medium: '6.5-8',
  weak: '2.0-4.5',
};

/**
 * Load calibration anchors from the validated reference set.
 * Picks `perTier` ads from strong and weak tiers as scoring anchors.
 */
export async function loadCalibrationAnchors(
  perTier = 2,
): Promise<CalibrationAnchor[]> {
  const raw = await readFile(REF_SET_PATH, 'utf8');
  const refAds: ReferenceAd[] = JSON.parse(raw);

  const strong = refAds.filter((a) => a.copy_tier === 'strong');
  const weak = refAds.filter((a) => a.copy_tier === 'weak');

  const anchors: CalibrationAnchor[] = [];

  for (const ad of strong.slice(0, perTier)) {
    anchors.push({
      label: 'strong',
      primaryText: ad.primary_text,
      headline: ad.headline,
      expectedScoreRange: SCORE_RANGES.strong,
    });
  }

  for (const ad of weak.slice(0, perTier)) {
    anchors.push({
      label: 'weak',
      primaryText: ad.primary_text || '(no copy)',
      headline: ad.headline,
      expectedScoreRange: SCORE_RANGES.weak,
    });
  }

  return anchors;
}
