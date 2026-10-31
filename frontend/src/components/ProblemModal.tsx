import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ProblemModal: React.FC = () => {
  const { problem, clearProblem } = useAuth();

  if (!problem) return null;

  const code = problem.code || (problem.status ? `HTTP_${problem.status}` : 'ERROR');
  const message = problem.message || problem.detail || 'An unexpected error occurred.';
  const violations = problem.violations || [];

  return (
    <div className="modal-overlay" onClick={clearProblem} id="problem-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(244, 63, 94, 0.2)', padding: '0.4rem', borderRadius: '8px', color: '#f43f5e' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Policy & Security Guard</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>RFC 9457 Problem Details</p>
            </div>
          </div>
          <button
            onClick={clearProblem}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
            <span className="badge badge-tier-critical font-mono" style={{ fontSize: '0.8rem' }}>
              {code}
            </span>
          </div>
          <p style={{ color: '#f1f5f9', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {violations.length > 0 && (
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.25)', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171', marginBottom: '0.4rem' }}>Violations Detected:</p>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
              {violations.map((v, idx) => (
                <li key={idx}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={clearProblem}>
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
