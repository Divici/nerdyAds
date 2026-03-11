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

export interface Ad {
  id: string;
  briefId: string;
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
  version: number;
  metadata: AdMetadata;
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
    ad?: Ad;
    adWithHistory?: AdWithHistory;
    evaluation?: Evaluation;
    result?: PipelineResult;
    error?: string;
    message?: string;
  };
}
