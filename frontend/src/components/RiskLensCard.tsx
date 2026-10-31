import React from 'react';
import { RiskLensEvaluation } from '../types';
import { Sparkles, TrendingDown, Info, ShieldCheck, AlertCircle } from 'lucide-react';

interface RiskLensCardProps {
  evaluation: RiskLensEvaluation | null;
  isLoading?: boolean;
  onApplyRecommendation?: (rec: any) => void;
}

export const RiskLensCard: React.FC<RiskLensCardProps> = ({
  evaluation,
  isLoading,
  onApplyRecommendation,
}) => {
  if (isLoading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <Sparkles size={28} className="countdown-pulse" style={{ color: '#818cf8', margin: '0 auto 0.5rem auto' }} />
        <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Evaluating risk profile with explainable weights...</p>
      </div>
    );
  }

  if (!evaluation) {
    return null;
  }

  const { risk_score, risk_tier, rationale, factors, counterfactuals } = evaluation;

  // Determine color scheme
  let color = '#10b981'; // Green
  let badgeClass = 'badge-active';
  if (risk_score >= 80) {
    color = '#f43f5e';
    badgeClass = 'badge-tier-critical';
  } else if (risk_score >= 50) {
    color = '#f59e0b';
    badgeClass = 'badge-tier-sensitive';
  } else if (risk_score >= 30) {
    color = '#38bdf8';
    badgeClass = 'badge-tier-standard';
  }

  return (
    <div className="glass-panel" style={{ border: `1px solid ${color}40`, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '0.35rem', borderRadius: '8px', color: '#818cf8' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Advisory AI: Risk Lens</h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Explainable score & counterfactual narrowing</p>
          </div>
        </div>
        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
          {risk_tier} RISK
        </span>
      </div>

      {/* Dial & Rationale */}
      <div className="risk-gauge-container" style={{ marginBottom: '1.25rem' }}>
        <div
          className="risk-score-circle"
          style={{
            background: `radial-gradient(circle, #0f172a 60%, ${color}25 100%)`,
            border: `3px solid ${color}`,
            color: color,
          }}
        >
          <span className="risk-score-num">{risk_score}</span>
          <span className="risk-score-lbl">/ 100</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.5, marginBottom: '0.5rem' }}>
            {rationale}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.75rem' }}>
            <Info size={13} />
            <span>Scores are non-binding recommendations; human reviewers retain accountable authority.</span>
          </div>
        </div>
      </div>

      {/* Factors Evidence */}
      {factors && factors.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Risk Factor Attribution
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {factors.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{f.factor}:</span>
                  <span style={{ color: '#94a3b8' }}>{f.description}</span>
                </div>
                <span className="font-mono" style={{ color: color, fontWeight: 700 }}>
                  +{f.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counterfactual Narrowing Recommendations */}
      {counterfactuals && counterfactuals.length > 0 && (
        <div>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingDown size={14} />
            <span>Counterfactual Narrowing Tips</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {counterfactuals.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#e0f2fe' }}>
                    {rec.reason}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    {rec.dimension}: {String(rec.current_value)} → {String(rec.suggested_value)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge badge-active font-mono" style={{ fontSize: '0.75rem' }}>
                    -{rec.potential_risk_reduction} pts
                  </span>
                  {onApplyRecommendation && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onApplyRecommendation(rec)}
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
