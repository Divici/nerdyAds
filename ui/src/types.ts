// Mirrored from src/types/* for the UI — avoids importing Zod in the browser

export type DimensionName =
  | 'clarity'
  | 'value_proposition'
  | 'emotional_resonance'
  | 'cta'
  | 'brand_voice';

export interface DimensionScore {
  dimension: DimensionName;
  score: number;
  rationale: string;
  confidence: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AdMetadata {
  model: string;
  seed: number;
  promptHash: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  generatedAt: string;
}

export interface AdImageRef {
  confirmedVariant: number;
  imagePath: string;
}

export interface Ad {
  id: string;
  briefId: string;
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
  version: number;
  metadata: AdMetadata;
  imageResult?: AdImageRef;
}

// Visual evaluation types (v2 — image generation)
export type VisualDimensionName = 'brand_consistency' | 'copy_alignment' | 'engagement_potential';

export interface VisualDimensionScore {
  dimension: VisualDimensionName;
  score: number;
  rationale: string;
  confidence: number;
}

export interface ImageVariant {
  variantIndex: number;
  imagePath: string;
  blurb: string;
  visualScores?: VisualDimensionScore[];
  metadata: AdMetadata;
}

export interface AdImageResult {
  adId: string;
  runId: string;
  variants: ImageVariant[];
  confirmedVariant?: number;
  generatedAt: string;
}

export interface Evaluation {
  adId: string;
  scores: DimensionScore[];
  weightedScore: number;
  overallConfidence: ConfidenceLevel;
  metadata: AdMetadata;
}

export interface AdWithHistory {
  ad: Ad;
  evaluations: Evaluation[];
  accepted: boolean;
  cyclesUsed: number;
  /** All ad versions: index 0 = original, index N = after Nth edit cycle */
  adVersions?: Ad[];
}

export interface BatchMetrics {
  briefId: string;
  adsGenerated: number;
  adsAccepted: number;
  acceptanceRate: number;
  averageScore: number;
  costUsd: number;
}

export interface BriefResult {
  briefId: string;
  ads?: AdWithHistory[];
  rejected?: AdWithHistory[];
  roundsUsed?: number;
  metrics?: BatchMetrics;
}

export interface PipelineResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  briefs?: BriefResult[];
  totalAdsGenerated: number;
  totalAdsAccepted: number;
  totalAdsRejected: number;
  acceptanceRate: number;
  averageScore: number;
  costPerAcceptedAd: number;
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export interface Brief {
  id: string;
  targetAudience: 'student' | 'parent' | 'both';
  campaignGoal: 'awareness' | 'conversion' | 'engagement';
  emotionalAngle: string;
  offer: string;
  constraints?: string[];
}

/** Pipeline generation mode — controls evaluator model and score threshold */
export type GenerationMode = 'quick' | 'quality';

/** Lifecycle status of an ad in the generation pipeline */
export type AdStatusType = 'generating' | 'evaluating' | 'improving' | 'accepted' | 'rejected';

export interface AdStatus {
  status: AdStatusType;
  /** Current edit cycle (1-based), set during improving/re-evaluating */
  cycle?: number;
}

// SSE event types
export type SSEEventType =
  | 'round:start'
  | 'ad:generating'
  | 'ad:evaluating'
  | 'ad:accepted'
  | 'ad:rejected'
  | 'ad:improving'
  | 'brief:complete'
  | 'pipeline:complete'
  | 'pipeline:error';

export interface SSEEvent {
  type: SSEEventType;
  data: {
    briefId?: string;
    round?: number;
    cycle?: number;
    ad?: Ad;
    adWithHistory?: AdWithHistory;
    evaluation?: Evaluation;
    result?: PipelineResult;
    error?: string;
    message?: string;
  };
}
