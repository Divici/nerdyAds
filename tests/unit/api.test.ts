import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/server/api.js';
import request from 'supertest';

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
      expect(res.body.length).toBe(10);
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
        .send({ briefId: 'student-aspire' });
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
      expect(res.body).toHaveProperty('briefCount', 10);
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
});
