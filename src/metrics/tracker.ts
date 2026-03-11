import type { BatchMetrics } from '../types/pipeline.js';

export interface AdRecord {
  accepted: boolean;
  score: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  briefId?: string;
}

export class MetricsTracker {
  private ads: AdRecord[] = [];
  private failures: Record<string, number> = {};

  recordAd(record: AdRecord): void {
    this.ads.push(record);
  }

  recordFailure(reason: string): void {
    this.failures[reason] = (this.failures[reason] ?? 0) + 1;
  }

  getSummary() {
    const totalAdsGenerated = this.ads.length;
    const totalAdsAccepted = this.ads.filter((a) => a.accepted).length;
    const acceptanceRate = totalAdsGenerated > 0 ? totalAdsAccepted / totalAdsGenerated : 0;
    const averageScore =
      totalAdsGenerated > 0
        ? this.ads.reduce((sum, a) => sum + a.score, 0) / totalAdsGenerated
        : 0;
    const totalCostUsd = this.ads.reduce((sum, a) => sum + a.costUsd, 0);
    const totalTokensIn = this.ads.reduce((sum, a) => sum + a.tokensIn, 0);
    const totalTokensOut = this.ads.reduce((sum, a) => sum + a.tokensOut, 0);

    return {
      totalAdsGenerated,
      totalAdsAccepted,
      acceptanceRate,
      averageScore,
      totalCostUsd,
      totalTokensIn,
      totalTokensOut,
    };
  }

  getQualityTrend(): number[] {
    return this.ads.map((a) => a.score);
  }

  getFailureCounts(): Record<string, number> {
    return { ...this.failures };
  }

  /** Cost per accepted ad (totalCost / acceptedCount), or 0 if none accepted. */
  getCostPerAcceptedAd(): number {
    const summary = this.getSummary();
    return summary.totalAdsAccepted > 0
      ? summary.totalCostUsd / summary.totalAdsAccepted
      : 0;
  }

  /** Number of rejected ads. */
  getRejectedCount(): number {
    return this.ads.filter((a) => !a.accepted).length;
  }

  getBatchMetrics(briefId: string): BatchMetrics {
    const briefAds = this.ads.filter((a) => a.briefId === briefId);
    const adsGenerated = briefAds.length;
    const adsAccepted = briefAds.filter((a) => a.accepted).length;
    const acceptanceRate = adsGenerated > 0 ? adsAccepted / adsGenerated : 0;
    const averageScore =
      adsGenerated > 0
        ? briefAds.reduce((sum, a) => sum + a.score, 0) / adsGenerated
        : 0;
    const costUsd = briefAds.reduce((sum, a) => sum + a.costUsd, 0);

    return { briefId, adsGenerated, adsAccepted, acceptanceRate, averageScore, costUsd };
  }
}
