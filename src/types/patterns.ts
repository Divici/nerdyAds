import { z } from 'zod';

export const CompetitorPatternSchema = z.object({
  hookTypes: z.array(z.string()),
  emotionalAngles: z.array(z.string()),
  ctaStyles: z.array(z.string()),
  commonPhrases: z.array(z.string()),
  structuralPatterns: z.array(z.string()),
  source: z.string(),
});

export type CompetitorPattern = z.infer<typeof CompetitorPatternSchema>;
