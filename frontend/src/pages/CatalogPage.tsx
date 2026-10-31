import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Resource, ResourceTier } from '../types';
import { useAuth } from '../context/AuthContext';
import { Layers, Database, Cpu, Wrench, Shield, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const data = await apiFetch('/api/resources');
        const list = Array.isArray(data) ? data : (data.resources || []);
        const normalized = list.map((r: any) => ({
          ...r,
          type: r.type || r.kind || 'MODEL',
          description: r.description || `Enterprise governed ${r.kind || 'resource'} under tier ${r.tier}`,
          max_duration_hours: r.max_duration_hours || (r.tier === 'RESTRICTED_SYNTHETIC' || r.tier === 'TIER_1_CRITICAL' ? 24 : 72),
          required_controls: r.required_controls || ['activity_logging', 'synthetic_data_only'],
          risk_score: r.risk_score || (r.tier === 'RESTRICTED_SYNTHETIC' || r.tier === 'TIER_1_CRITICAL' ? 85 : r.tier === 'INTERNAL_SYNTHETIC' || r.tier === 'TIER_2_SENSITIVE' ? 55 : 20),
        }));
        setResources(normalized);
      } catch (err) {
        console.error('Failed to load catalog', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResources();
  }, []);

  const filtered = resources.filter((r) => {
    if (filterType === 'ALL') return true;
    return (r.type === filterType || (r as any).kind === filterType);
  });

  const getTierBadge = (tier: ResourceTier) => {
    switch (tier) {
      case 'TIER_1_CRITICAL':
        return <span className="badge badge-tier-critical">Tier 1 Critical</span>;
      case 'TIER_2_SENSITIVE':
        return <span className="badge badge-tier-sensitive">Tier 2 Sensitive</span>;
      default:
        return <span className="badge badge-tier-standard">Tier 3 Standard</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MODEL':
        return <Cpu size={18} color="var(--accent-primary)" />;
      case 'DATASET':
        return <Database size={18} color="#7c3aed" />;
      default:
        return <Wrench size={18} color="#059669" />;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Enterprise Resource Catalog</h1>
          <p className="page-subtitle">
            Governed AI models, datasets, and analytical tools under strict Separation-of-Duties (SoD) policies.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ALL', 'MODEL', 'DATASET', 'TOOL'].map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading governed resources...</p>
        </div>
      ) : (
        <div className="grid-catalog">
          {filtered.map((res) => (
            <div key={res.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getTypeIcon(res.type)}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {res.type}
                    </span>
                  </div>
                  {getTierBadge(res.tier)}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  {res.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', minHeight: '40px', lineHeight: 1.5 }}>
                  {res.description}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Max Duration:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      <Clock size={13} /> {res.max_duration_hours} hours
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Risk Score:</span>
                    <span className="font-mono" style={{ fontWeight: 800, color: res.risk_score > 60 ? 'var(--accent-rose)' : res.risk_score > 30 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                      {res.risk_score} / 100
                    </span>
                  </div>

                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Allowed Actions:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {res.allowed_actions.map((act) => (
                        <span key={act} className="badge font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.7rem', border: '1px solid var(--border-subtle)' }}>
                          {act}
                        </span>
                      ))}
                    </div>
                  </div>

                  {res.required_controls.length > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Required Controls:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {res.required_controls.map((ctrl) => (
                          <span key={ctrl} className="badge font-mono" style={{ background: '#ffedd5', color: 'var(--accent-primary)', fontSize: '0.7rem', border: '1px solid #fed7aa' }}>
                            {ctrl}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                onClick={() => navigate(`/requests/new?resource=${res.id}`)}
                id={`request-btn-${res.id}`}
              >
                <span>Request Access</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
