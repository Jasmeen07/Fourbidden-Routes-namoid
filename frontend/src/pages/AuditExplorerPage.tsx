import React, { useState, useEffect } from 'react';
import { AuditEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, RefreshCw, Filter, Link2, CheckCircle2, ChevronDown, ChevronRight, Hash } from 'lucide-react';

export const AuditExplorerPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    events_verified: number;
    head_hash?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const [filterActor, setFilterActor] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/audit');
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await apiFetch('/api/audit/verify');
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        events_verified: 0,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    verifyChain();
  }, []);

  const toggleExpand = (seq: number) => {
    setExpandedSeq(expandedSeq === seq ? null : seq);
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'ALL' && ev.event_type !== filterType) return false;
    if (filterActor && !ev.actor_id.toLowerCase().includes(filterActor.toLowerCase())) return false;
    return true;
  });

  const uniqueTypes = ['ALL', ...Array.from(new Set(events.map((e) => e.event_type)))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cryptographic Audit Chain</h1>
          <p className="page-subtitle">
            Tamper-evident, hash-chained log protected by SQLite append-only database triggers (TR-AUDIT-NO-UPDATE).
          </p>
        </div>

        {/* Chain Verification Status Badge & Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {verificationResult && (
            <div
              className={`badge ${verificationResult.valid ? 'badge-active' : 'badge-revoked'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 700 }}
              id="audit-verify-badge"
            >
              {verificationResult.valid ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Chain verified ✓ ({verificationResult.events_verified} events)</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>Chain Tampered! Invalid SHA-256</span>
                </>
              )}
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={verifyChain}
            disabled={isVerifying}
            id="btn-verify-audit"
          >
            <RefreshCw size={14} className={isVerifying ? 'countdown-pulse' : ''} />
            <span>{isVerifying ? 'Verifying...' : 'Re-verify Chain'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#94a3b8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Filters:</span>
        </div>

        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '180px' }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="text"
          className="form-input"
          style={{ width: '200px' }}
          placeholder="Filter by Actor ID..."
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading chained audit log...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>No audit events found matching the filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredEvents.map((ev) => {
            const isExpanded = expandedSeq === ev.seq;
            let typeColor = '#38bdf8';
            if (ev.event_type.includes('TAMPER') || ev.event_type.includes('FAILURE')) typeColor = '#f43f5e';
            if (ev.event_type.includes('GRANT') || ev.event_type.includes('APPROVED')) typeColor = '#10b981';
            if (ev.event_type.includes('REVOKE') || ev.event_type.includes('NARROW')) typeColor = '#f59e0b';

            return (
              <div
                key={ev.seq}
                className="glass-panel"
                style={{ padding: '1rem 1.25rem', cursor: 'pointer' }}
                onClick={() => toggleExpand(ev.seq)}
                id={`audit-event-${ev.seq}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isExpanded ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                    <span className="badge font-mono" style={{ background: '#1e293b', color: '#94a3b8' }}>
                      #{ev.seq}
                    </span>
                    <span
                      className="badge font-mono"
                      style={{ background: `${typeColor}20`, color: typeColor, border: `1px solid ${typeColor}50` }}
                    >
                      {ev.event_type}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      Actor: <strong style={{ color: '#fff' }}>{ev.actor_id}</strong>
                    </span>
                    {ev.resource_id && (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Resource: <span className="font-mono">{ev.resource_id}</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>{new Date(ev.recorded_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Chained Hash previews */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Hash size={12} />
                    <span>Hash: <span className="font-mono" style={{ color: '#94a3b8' }}>{ev.hash?.slice(0, 16)}...</span></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Link2 size={12} />
                    <span>Prev: <span className="font-mono" style={{ color: '#94a3b8' }}>{ev.prev_hash?.slice(0, 16)}...</span></span>
                  </div>
                </div>

                {/* Expanded Payload view */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '1rem',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid var(--border-subtle)',
                      padding: '1rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 600 }}>
                      Complete Canonical Audit Record:
                    </div>
                    <pre className="font-mono" style={{ background: '#00000050', padding: '0.75rem', borderRadius: '6px', overflowX: 'auto', color: '#e2e8f0' }}>
                      {JSON.stringify(ev, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
