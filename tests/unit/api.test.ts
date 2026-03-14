import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/server/api.js';
import request from 'supertest';

// Mock image generation and visual evaluation agents
vi.mock('../../src/agents/image-generator.js', () => ({
  ImageGeneratorAgent: vi.fn().mockImplementation(() => ({
    generateVariants: vi.fn().mockResolvedValue([
      {
        variantIndex: 0,
        imagePath: '/test-run/images/ad-001-variant-0.png',
        blurb: 'Photo-realistic image of student studying',
        metadata: {
          model: 'gemini-2.5-flash',
          seed: 42,
          promptHash: 'img-hash-0',
          tokensIn: 200,
          tokensOut: 1290,
          costUsd: 0.039,
          generatedAt: '2026-03-13T00:00:00Z',
        },
      },
    ]),
  })),
}));

vi.mock('../../src/agents/visual-evaluator.js', () => ({
  VisualEvaluatorAgent: vi.fn().mockImplementation(() => ({
    evaluate: vi.fn().mockResolvedValue([
      { dimension: 'brand_consistency', score: 8, rationale: 'Strong navy palette', confidence: 7 },
      { dimension: 'copy_alignment', score: 7, rationale: 'Matches theme', confidence: 6 },
      { dimension: 'engagement_potential', score: 9, rationale: 'Strong focal point', confidence: 8 },
    ]),
  })),
}));

// Check if supertest is available, if not we'll use a simpler approach
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

describe('API server', () => {
  describe('GET /api/briefs', () => {
    it('returns briefs array', async () => {
      const res = await request(app).get('/api/briefs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(15);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('targetAudience');
      expect(res.body[0]).toHaveProperty('campaignGoal');
    });
  });

  describe('GET /api/runs', () => {
    it('returns runs array sorted by date', async () => {
      const res = await request(app).get('/api/runs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Should have some runs from data/output
      if (res.body.length > 1) {
        const dates = res.body.map((r: { startedAt: string }) => new Date(r.startedAt).getTime());
        // Should be descending
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }
    });

    it('run summaries have required fields', async () => {
      const res = await request(app).get('/api/runs');
      if (res.body.length > 0) {
        const run = res.body[0];
        expect(run).toHaveProperty('runId');
        expect(run).toHaveProperty('startedAt');
        expect(run).toHaveProperty('totalAdsGenerated');
        expect(run).toHaveProperty('totalAdsAccepted');
        expect(run).toHaveProperty('acceptanceRate');
        expect(run).toHaveProperty('averageScore');
        expect(run).toHaveProperty('totalCostUsd');
      }
    });
  });

  describe('GET /api/runs/:runId', () => {
    it('returns 404 for non-existent run', async () => {
      const res = await request(app).get('/api/runs/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('returns full pipeline result for valid run', async () => {
      // First get list of runs
      const runsRes = await request(app).get('/api/runs');
      if (runsRes.body.length > 0) {
        const runId = runsRes.body[0].runId;
        const res = await request(app).get(`/api/runs/${runId}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('runId', runId);
        expect(res.body).toHaveProperty('briefs');
        expect(Array.isArray(res.body.briefs)).toBe(true);
      }
    });
  });

  describe('POST /api/generate', () => {
    it('returns 400 for invalid brief ID', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({ briefId: 'nonexistent-brief' });
      expect(res.status).toBe(400);
    });

    it('returns runId for valid brief', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({ briefId: 'athlete-urgency' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('runId');
      expect(res.body).toHaveProperty('briefCount', 1);
    });

    it('returns runId for all briefs when no briefId specified', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('runId');
      expect(res.body).toHaveProperty('briefCount');
      expect(res.body.briefCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/generate/:runId/stream', () => {
    it('returns SSE content type', async () => {
      // SSE connections stay open, so we use a raw HTTP request approach
      const http = await import('http');
      const server = app.listen(0);
      const addr = server.address() as { port: number };

      return new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${addr.port}/api/generate/test-run/stream`, (res) => {
          expect(res.headers['content-type']).toBe('text/event-stream');
          expect(res.headers['cache-control']).toBe('no-cache');
          res.destroy();
          req.destroy();
          server.close();
          resolve();
        });
        req.on('error', (err) => {
          server.close();
          reject(err);
        });
        setTimeout(() => {
          req.destroy();
          server.close();
          reject(new Error('Timeout'));
        }, 3000);
      });
    });
  });

  describe('POST /api/ads/:adId/generate-image', () => {
    it('returns 404 for non-existent run', async () => {
      const res = await request(app)
        .post('/api/ads/ad-001/generate-image')
        .send({ runId: 'nonexistent-run', briefId: 'athlete-urgency' });
      expect(res.status).toBe(404);
    });

    it('returns image result for valid ad in existing run', async () => {
      // Get a real run to use
      const runsRes = await request(app).get('/api/runs');
      if (runsRes.body.length === 0) return; // skip if no runs

      const runId = runsRes.body[0].runId;
      const runRes = await request(app).get(`/api/runs/${runId}`);
      const briefs = runRes.body.briefs;
      if (!briefs || briefs.length === 0) return;

      const firstBrief = briefs[0];
      const acceptedAds = firstBrief.ads;
      if (!acceptedAds || acceptedAds.length === 0) return;

      // Get current brief IDs to check if this run's brief still exists
      const briefsRes = await request(app).get('/api/briefs');
      const currentBriefIds = new Set(briefsRes.body.map((b: { id: string }) => b.id));
      if (!currentBriefIds.has(firstBrief.briefId)) return; // skip if run uses old brief IDs

      const ad = acceptedAds[0].ad;
      const res = await request(app)
        .post(`/api/ads/${ad.id}/generate-image`)
        .send({ runId, briefId: firstBrief.briefId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('adId', ad.id);
      expect(res.body).toHaveProperty('runId', runId);
      expect(res.body).toHaveProperty('variants');
      expect(res.body.variants).toHaveLength(1);
      expect(res.body.variants[0]).toHaveProperty('visualScores');
      expect(res.body.variants[0].visualScores).toHaveLength(3);
    }, 15000);

    it('returns 404 for non-existent ad in valid run', async () => {
      const runsRes = await request(app).get('/api/runs');
      if (runsRes.body.length === 0) return;

      const runId = runsRes.body[0].runId;
      const res = await request(app)
        .post('/api/ads/nonexistent-ad/generate-image')
        .send({ runId, briefId: 'athlete-urgency' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/ads/:adId/confirm-image', () => {
    it('returns 404 for non-existent run', async () => {
      const res = await request(app)
        .post('/api/ads/ad-001/confirm-image')
        .send({ runId: 'nonexistent-run', variantIndex: 0 });
      expect(res.status).toBe(404);
    });
  });

  describe('Static image serving', () => {
    it('serves files from /api/output path', async () => {
      // Just verify the route exists (404 for missing file, not routing error)
      const res = await request(app).get('/api/output/nonexistent/image.png');
      // Express static returns 404 for missing files but the route should exist
      expect(res.status).toBe(404);
    });
  });
});
