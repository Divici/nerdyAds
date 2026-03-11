import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import type { AdWithHistory, BriefResult, PipelineResult, DimensionName } from '../types.ts';

const DIMENSION_LABELS: Record<DimensionName, string> = {
  clarity: 'Clarity',
  value_proposition: 'Value Prop',
  emotional_resonance: 'Emotional',
  cta: 'CTA',
  brand_voice: 'Brand Voice',
};

interface InsightsTabProps {
  accepted: AdWithHistory[];
  rejected: AdWithHistory[];
  pipelineResult?: PipelineResult | null;
}

export function InsightsTab({ accepted, rejected, pipelineResult }: InsightsTabProps) {
  const allAds = [...accepted, ...rejected];

  if (allAds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center">
        <div className="text-4xl mb-3 opacity-20">&#x1F4CA;</div>
        <p className="text-gray-400">No data yet. Generate some ads to see insights.</p>
      </div>
    );
  }

  // Summary stats
  const totalAds = allAds.length;
  const acceptedCount = accepted.length;
  const rejectedCount = rejected.length;
  const acceptanceRate = totalAds > 0 ? (acceptedCount / totalAds) * 100 : 0;
  const avgScore =
    allAds.reduce(
      (sum, a) => sum + a.evaluations[a.evaluations.length - 1].weightedScore,
      0,
    ) / totalAds;
  const totalCost = allAds.reduce(
    (sum, a) =>
      sum +
      a.ad.metadata.costUsd +
      a.evaluations.reduce((s, e) => s + e.metadata.costUsd, 0),
    0,
  );
  const costPerAccepted = acceptedCount > 0 ? totalCost / acceptedCount : 0;

  // Dimension averages for radar chart
  const dimensionNames: DimensionName[] = [
    'clarity',
    'value_proposition',
    'emotional_resonance',
    'cta',
    'brand_voice',
  ];
  const dimAvgs = dimensionNames.map((dim) => {
    const scores = allAds.map((a) => {
      const lastEval = a.evaluations[a.evaluations.length - 1];
      return lastEval.scores.find((s) => s.dimension === dim)?.score ?? 0;
    });
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return { dimension: DIMENSION_LABELS[dim], score: parseFloat(avg.toFixed(1)), fullMark: 10 };
  });

  // Per-brief breakdown for bar chart
  const briefData = (pipelineResult?.briefs ?? []).map((b: BriefResult) => ({
    brief: b.briefId.replace('brief-', '#'),
    accepted: b.ads?.length ?? 0,
    rejected: b.rejected?.length ?? 0,
    avgScore: b.metrics?.averageScore ? parseFloat(b.metrics.averageScore.toFixed(1)) : 0,
  }));

  // Quality trend — scores ordered by generation time
  const trendData = allAds
    .sort(
      (a, b) =>
        new Date(a.ad.metadata.generatedAt).getTime() -
        new Date(b.ad.metadata.generatedAt).getTime(),
    )
    .map((a, i) => ({
      index: i + 1,
      score: a.evaluations[a.evaluations.length - 1].weightedScore,
      accepted: a.accepted,
    }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <SummaryCard label="Total Ads" value={totalAds.toString()} />
        <SummaryCard label="Accepted" value={acceptedCount.toString()} accent="green" />
        <SummaryCard label="Rejected" value={rejectedCount.toString()} accent="red" />
        <SummaryCard label="Acceptance Rate" value={`${acceptanceRate.toFixed(0)}%`} />
        <SummaryCard label="Avg Score" value={avgScore.toFixed(1)} />
        <SummaryCard label="Total Cost" value={`$${totalCost.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-heading font-semibold text-vt-text mb-4">
            Dimension Averages
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={dimAvgs}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#20205F' }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Radar
                dataKey="score"
                stroke="#e1245a"
                fill="#e1245a"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-Brief Breakdown */}
        {briefData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-heading font-semibold text-vt-text mb-4">
              Per-Brief Results
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={briefData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="brief" tick={{ fontSize: 11, fill: '#20205F' }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="accepted" fill="#22c55e" name="Accepted" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quality Trend */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
        <h3 className="text-sm font-heading font-semibold text-vt-text mb-4">Quality Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: 'Ad #', position: 'insideBottom', offset: -5, fontSize: 11 }} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(1), 'Score']}
              labelFormatter={(label) => `Ad #${label}`}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#e1245a"
              strokeWidth={2}
              dot={(props: { cx: number; cy: number; payload: { accepted: boolean } }) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={payload.accepted ? '#22c55e' : '#ef4444'}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
            />
            {/* Threshold line */}
            <Line
              type="monotone"
              dataKey={() => 7.5}
              stroke="#007ac0"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              name="Threshold"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-score-good inline-block" /> Accepted
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-score-bad inline-block" /> Rejected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-vt-accent inline-block" style={{ borderTop: '1px dashed' }} /> Threshold (7.5)
          </span>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-heading font-semibold text-vt-text mb-4">Cost Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Total Cost</p>
            <p className="text-lg font-semibold text-vt-text">${totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cost / Accepted Ad</p>
            <p className="text-lg font-semibold text-vt-text">${costPerAccepted.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Tokens</p>
            <p className="text-lg font-semibold text-vt-text">
              {(pipelineResult?.totalTokensIn ?? 0) + (pipelineResult?.totalTokensOut ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Avg Score / $0.01</p>
            <p className="text-lg font-semibold text-vt-text">
              {totalCost > 0 ? ((avgScore / totalCost) * 0.01).toFixed(2) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'red';
}) {
  const textColor = accent === 'green' ? 'text-score-good' : accent === 'red' ? 'text-score-bad' : 'text-vt-text';
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-heading font-semibold ${textColor}`}>{value}</p>
    </div>
  );
}
