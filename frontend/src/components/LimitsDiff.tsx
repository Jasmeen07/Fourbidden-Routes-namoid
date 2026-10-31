import React from 'react';
import { ResourceLimits } from '../types';
import { ArrowRight } from 'lucide-react';

interface LimitsDiffProps {
  requested: ResourceLimits;
  narrowed?: ResourceLimits | null;
}

export const LimitsDiff: React.FC<LimitsDiffProps> = ({ requested, narrowed }) => {
  if (!narrowed) {
    return (
      <div className="limits-diff-box">
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Active Requested Limits:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
          {requested.max_records !== undefined && (
            <div><span style={{ color: 'var(--text-secondary)' }}>Max Records:</span> <strong style={{ color: 'var(--text-primary)' }}>{requested.max_records.toLocaleString()}</strong></div>
          )}
          {requested.max_rps !== undefined && (
            <div><span style={{ color: 'var(--text-secondary)' }}>Max RPS:</span> <strong style={{ color: 'var(--text-primary)' }}>{requested.max_rps} req/s</strong></div>
          )}
          {requested.max_cost_usd !== undefined && (
            <div><span style={{ color: 'var(--text-secondary)' }}>Max Cost:</span> <strong style={{ color: 'var(--text-primary)' }}>${requested.max_cost_usd}</strong></div>
          )}
          {requested.allowed_formats && (
            <div><span style={{ color: 'var(--text-secondary)' }}>Formats:</span> <strong style={{ color: 'var(--text-primary)' }}>{requested.allowed_formats.join(', ')}</strong></div>
          )}
          {requested.ip_allowlist && (
            <div><span style={{ color: 'var(--text-secondary)' }}>IP Allowlist:</span> <strong style={{ color: 'var(--text-primary)' }}>{requested.ip_allowlist.join(', ') || 'Any'}</strong></div>
          )}
        </div>
      </div>
    );
  }

  // Check diffs
  const hasDiff = JSON.stringify(requested) !== JSON.stringify(narrowed);

  return (
    <div className="limits-diff-box" style={{ border: hasDiff ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)', background: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: hasDiff ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
          {hasDiff ? 'Scope Narrowing Applied (Subsets Only)' : 'Identical Scope'}
        </span>
        {hasDiff && (
          <span className="badge badge-tier-sensitive font-mono" style={{ fontSize: '0.7rem' }}>
            NARROWED
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* max_records */}
        {requested.max_records !== undefined && (
          <div className="diff-row">
            <span style={{ color: 'var(--text-secondary)' }}>Max Records</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {narrowed.max_records !== undefined && narrowed.max_records !== requested.max_records ? (
                <>
                  <span className="diff-orig">{requested.max_records.toLocaleString()}</span>
                  <ArrowRight size={14} color="var(--accent-amber)" />
                  <span className="diff-narrow">{narrowed.max_records.toLocaleString()}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{requested.max_records.toLocaleString()}</span>
              )}
            </div>
          </div>
        )}

        {/* max_rps */}
        {requested.max_rps !== undefined && (
          <div className="diff-row">
            <span style={{ color: 'var(--text-secondary)' }}>Max Rate (RPS)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {narrowed.max_rps !== undefined && narrowed.max_rps !== requested.max_rps ? (
                <>
                  <span className="diff-orig">{requested.max_rps}</span>
                  <ArrowRight size={14} color="var(--accent-amber)" />
                  <span className="diff-narrow">{narrowed.max_rps} req/s</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{requested.max_rps} req/s</span>
              )}
            </div>
          </div>
        )}

        {/* max_cost_usd */}
        {requested.max_cost_usd !== undefined && (
          <div className="diff-row">
            <span style={{ color: 'var(--text-secondary)' }}>Max Budget</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {narrowed.max_cost_usd !== undefined && narrowed.max_cost_usd !== requested.max_cost_usd ? (
                <>
                  <span className="diff-orig">${requested.max_cost_usd}</span>
                  <ArrowRight size={14} color="var(--accent-amber)" />
                  <span className="diff-narrow">${narrowed.max_cost_usd}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>${requested.max_cost_usd}</span>
              )}
            </div>
          </div>
        )}

        {/* allowed_formats */}
        {requested.allowed_formats && (
          <div className="diff-row">
            <span style={{ color: 'var(--text-secondary)' }}>Formats</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {narrowed.allowed_formats && JSON.stringify(narrowed.allowed_formats) !== JSON.stringify(requested.allowed_formats) ? (
                <>
                  <span className="diff-orig">{requested.allowed_formats.join(', ')}</span>
                  <ArrowRight size={14} color="var(--accent-amber)" />
                  <span className="diff-narrow">{narrowed.allowed_formats.join(', ')}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{requested.allowed_formats.join(', ')}</span>
              )}
            </div>
          </div>
        )}

        {/* ip_allowlist */}
        {requested.ip_allowlist && (
          <div className="diff-row">
            <span style={{ color: 'var(--text-secondary)' }}>IP Allowlist</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {narrowed.ip_allowlist && JSON.stringify(narrowed.ip_allowlist) !== JSON.stringify(requested.ip_allowlist) ? (
                <>
                  <span className="diff-orig">{requested.ip_allowlist.join(', ') || 'Any'}</span>
                  <ArrowRight size={14} color="var(--accent-amber)" />
                  <span className="diff-narrow">{narrowed.ip_allowlist.join(', ')}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{requested.ip_allowlist.join(', ') || 'Any'}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
