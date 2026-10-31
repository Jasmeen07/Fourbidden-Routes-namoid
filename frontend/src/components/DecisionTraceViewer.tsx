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
    <div className="glass-panel" style={{ marginTop: '1.5rem', border: isAllow ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)' }} id="pdp-trace-result">
      {/* Top Decision Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          background: isAllow
            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.15))'
            : 'linear-gradient(90deg, rgba(244, 63, 94, 0.2), rgba(239, 68, 68, 0.15))',
          border: isAllow ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(244, 63, 94, 0.5)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {isAllow ? (
            <ShieldCheck size={32} color="#10b981" />
          ) : (
            <ShieldAlert size={32} color="#f43f5e" />
          )}
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: isAllow ? '#34d399' : '#f87171' }}>
              PEP DECISION: {trace.decision}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              Action: <strong className="font-mono">{trace.action}</strong> on Resource: <strong className="font-mono">{trace.resource_id}</strong>
              {trace.denial_reason && ` — Reason: ${trace.denial_reason}`}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="badge font-mono" style={{ background: 'rgba(0,0,0,0.4)', color: '#94a3b8' }}>
            {trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : 'evaluated'}
          </span>
        </div>
      </div>

      {/* Ordered Step Evaluation */}
      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
        Ordered PDP Evaluation Trace (Deterministic Short-Circuit)
      </h4>
      <div className="trace-container">
        {trace.steps.map((step, idx) => {
          const isPass = step.status === 'PASS';
          return (
            <div
              key={idx}
              className={`trace-step ${isPass ? 'trace-step-pass' : 'trace-step-fail'}`}
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
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isPass ? '#f1f5f9' : '#fca5a5' }}>
                    {idx + 1}. {step.check}
                  </span>
                  <span className={`badge ${isPass ? 'badge-active' : 'badge-revoked'} font-mono`} style={{ fontSize: '0.68rem' }}>
                    {step.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mock Payload Preview if Allowed */}
      {trace.mock_response && isAllow && (
        <div style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.9)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
            <Cpu size={16} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Synthetic Resource Response (Watermarked)</span>
          </div>
          <div style={{ background: '#0284c7', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', marginBottom: '0.5rem' }}>
            {trace.mock_response.watermark}
          </div>
          <pre style={{ fontSize: '0.8rem', color: '#e2e8f0', background: '#00000060', padding: '0.75rem', borderRadius: '6px', overflowX: 'auto' }}>
            {JSON.stringify(trace.mock_response.payload_preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
