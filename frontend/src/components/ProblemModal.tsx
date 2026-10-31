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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#fee2e2', padding: '0.45rem', borderRadius: '8px', color: 'var(--accent-rose)' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Policy & Security Guard</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>RFC 9457 Problem Details</p>
            </div>
          </div>
          <button
            onClick={clearProblem}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
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
          <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        </div>

        {violations.length > 0 && (
          <div style={{ background: '#fff1f2', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fecdd3', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9f1239', marginBottom: '0.4rem', margin: '0 0 0.4rem 0' }}>Violations Detected:</p>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#be123c', margin: 0 }}>
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
