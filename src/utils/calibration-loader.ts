import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CalibrationAnchor, FewShotExample } from '../config/prompts.js';

const REF_SET_PATH = path.resolve('data/reference/reference-set.json');

interface ReferenceAd {
  id: string;
  copy_tier: string;
  tier_rationale?: string;
  primary_text: string;
  headline: string;
  description?: string;
  cta_button?: string;
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

/**
 * Load few-shot examples for the writer prompt.
 * Picks 1 strong + 1 weak ad from the reference set.
 */
export async function loadWriterFewShotExamples(): Promise<FewShotExample[]> {
  const raw = await readFile(REF_SET_PATH, 'utf8');
  const refAds: ReferenceAd[] = JSON.parse(raw);

  const strong = refAds.find((a) => a.copy_tier === 'strong');
  const weak = refAds.find((a) => a.copy_tier === 'weak');

  const examples: FewShotExample[] = [];

  if (strong) {
    examples.push({
      tier: 'strong',
      primaryText: strong.primary_text,
      headline: strong.headline,
      description: strong.description || '',
      ctaButton: strong.cta_button || 'Learn more',
      tierRationale: strong.tier_rationale || 'High quality ad.',
    });
  }

  if (weak) {
    examples.push({
      tier: 'weak',
      primaryText: weak.primary_text || '(no copy)',
      headline: weak.headline,
      description: weak.description || '',
      ctaButton: weak.cta_button || 'Learn more',
      tierRationale: weak.tier_rationale || 'Low quality ad.',
    });
  }

  return examples;
}
