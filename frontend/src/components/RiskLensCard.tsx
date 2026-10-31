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
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
        <Sparkles size={28} className="countdown-pulse" style={{ color: 'var(--accent-primary)', margin: '0 auto 0.5rem auto' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Evaluating risk profile with explainable weights (Innovation 1)...</p>
      </div>
    );
  }

  if (!evaluation) {
    return null;
  }

  const { risk_score, risk_tier, rationale, factors, counterfactuals } = evaluation;

  // Determine color scheme
  let color = 'var(--accent-emerald)';
  let badgeClass = 'badge-active';
  if (risk_score >= 80) {
    color = 'var(--accent-rose)';
    badgeClass = 'badge-tier-critical';
  } else if (risk_score >= 50) {
    color = 'var(--accent-amber)';
    badgeClass = 'badge-tier-sensitive';
  } else if (risk_score >= 30) {
    color = 'var(--accent-cyan)';
    badgeClass = 'badge-tier-standard';
  }

  return (
    <div className="glass-panel" style={{ border: `1px solid ${color}`, background: '#ffffff', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: '#ffedd5', padding: '0.4rem', borderRadius: '8px', color: 'var(--accent-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Advisory AI: Risk Lens (Innovation 1)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Explainable score & counterfactual narrowing
            </p>
          </div>
        </div>
        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', fontWeight: 800 }}>
          {risk_tier} RISK
        </span>
      </div>

      {/* Dial & Rationale */}
      <div className="risk-gauge-container" style={{ marginBottom: '1.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <div
          className="risk-score-circle"
          style={{
            background: '#ffffff',
            border: `3px solid ${color}`,
            color: color,
          }}
        >
          <span className="risk-score-num">{risk_score}</span>
          <span className="risk-score-lbl" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
            {rationale}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Info size={13} />
            <span>Scores are non-binding recommendations; human reviewers retain accountable authority.</span>
          </div>
        </div>
      </div>

      {/* Factors Evidence */}
      {factors && factors.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.factor}:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.description}</span>
                </div>
                <span className="font-mono" style={{ color: color, fontWeight: 800 }}>
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
          <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#0369a1' }}>
                    {rec.reason}
                  </div>
                  <div style={{ color: '#0284c7', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    {rec.dimension}: {String(rec.current_value)} &rarr; <strong>{String(rec.suggested_value)}</strong>
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
