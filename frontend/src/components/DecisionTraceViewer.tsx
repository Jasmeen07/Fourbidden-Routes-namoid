import React from 'react';
import { PdpDecisionTrace } from '../types';
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';

interface DecisionTraceViewerProps {
  trace: PdpDecisionTrace | null;
}

export const DecisionTraceViewer: React.FC<DecisionTraceViewerProps> = ({ trace }) => {
  if (!trace) return null;

  const isAllow = trace.decision === 'ALLOW';

  return (
    <div 
      className="glass-panel" 
      style={{ 
        marginTop: '1.5rem', 
        border: isAllow ? '1px solid #a7f3d0' : '1px solid #fecdd3',
        background: '#ffffff',
        boxShadow: 'var(--shadow-sm)'
      }} 
      id="pdp-trace-result"
    >
      {/* Top Decision Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          background: isAllow
            ? 'linear-gradient(90deg, #ecfdf5, #f0fdf4)'
            : 'linear-gradient(90deg, #fff1f2, #fff5f5)',
          border: isAllow ? '1px solid #a7f3d0' : '1px solid #fecdd3',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {isAllow ? (
            <ShieldCheck size={32} color="#059669" />
          ) : (
            <ShieldAlert size={32} color="#e11d48" />
          )}
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: isAllow ? '#065f46' : '#9f1239', margin: 0 }}>
              PEP DECISION: {trace.decision}
            </h3>
            <p style={{ fontSize: '0.825rem', color: isAllow ? '#047857' : '#be123c', margin: '0.2rem 0 0 0' }}>
              Action: <strong className="font-mono">{trace.action}</strong> on Resource: <strong className="font-mono">{trace.resource_id}</strong>
              {trace.denial_reason && ` — Reason: ${trace.denial_reason}`}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="badge font-mono" style={{ background: '#ffffff', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : 'evaluated'}
          </span>
        </div>
      </div>

      {/* Ordered Step Evaluation */}
      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
        Ordered PDP Evaluation Trace (Deterministic Short-Circuit)
      </h4>
      <div className="trace-container">
        {trace.steps && trace.steps.map((step, idx) => {
          const isPass = step.status === 'PASS';
          return (
            <div
              key={idx}
              className={`trace-step ${isPass ? 'trace-step-pass' : 'trace-step-fail'}`}
              style={{
                background: isPass ? '#f0fdf4' : '#fff1f2',
                border: isPass ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                borderLeft: isPass ? '4px solid #10b981' : '4px solid #f43f5e',
              }}
            >
              <div className="trace-icon">
                {isPass ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <XCircle size={18} color="#f43f5e" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isPass ? '#065f46' : '#9f1239' }}>
                    {idx + 1}. {step.check}
                  </span>
                  <span className={`badge ${isPass ? 'badge-active' : 'badge-revoked'} font-mono`} style={{ fontSize: '0.68rem' }}>
                    {step.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mock Payload Preview if Allowed */}
      {trace.mock_response && isAllow && (
        <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
            <Cpu size={16} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Synthetic Resource Response (Watermarked)</span>
          </div>
          <div style={{ background: '#ffedd5', color: 'var(--accent-primary)', border: '1px solid #fed7aa', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', marginBottom: '0.5rem' }}>
            {trace.mock_response.watermark}
          </div>
          <pre style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '6px', overflowX: 'auto', margin: 0 }}>
            {JSON.stringify(trace.mock_response.payload_preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
