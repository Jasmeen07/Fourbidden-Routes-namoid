import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Resource } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Database,
  Cpu,
  Wrench,
  Shield,
  ArrowRight,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  Layers,
} from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const data = await apiFetch('/api/resources');
        const list = Array.isArray(data) ? data : (data.resources || []);
        const normalized: Resource[] = list.map((r: any) => {
          const kindStr = (r.kind || r.type || 'model').toUpperCase();
          const cleanType = kindStr === 'DATASET' ? 'DATASET' : kindStr === 'TOOL' ? 'TOOL' : 'MODEL';
          
          // Flatten allowed_actions to array of strings
          const actions = Array.isArray(r.allowed_actions)
            ? r.allowed_actions.map((a: any) => (typeof a === 'string' ? a : a?.name || String(a)))
            : [];

          return {
            id: r.id,
            name: r.name || r.id,
            type: cleanType as any,
            tier: r.tier || 'INTERNAL_SYNTHETIC',
            description: r.description || `Enterprise governed ${r.kind || 'resource'} under tier ${r.tier}`,
            allowed_actions: actions,
            max_duration_hours: r.max_duration_hours || (r.tier === 'RESTRICTED_SYNTHETIC' || r.tier === 'TIER_1_CRITICAL' ? 24 : 72),
            required_controls: r.required_controls || (r.tier === 'RESTRICTED_SYNTHETIC' ? ['activity_logging', 'synthetic_data_only', 'isolated_workspace'] : ['activity_logging', 'synthetic_data_only']),
            department: r.department || 'General',
            sensitivity: r.sensitivity || (r.tier === 'RESTRICTED_SYNTHETIC' ? 'CRITICAL' : 'INTERNAL'),
            is_crucial: !!r.is_crucial || r.tier === 'RESTRICTED_SYNTHETIC',
            is_active: r.active !== false,
          };
        });
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
    // Type Filter
    if (filterType !== 'ALL') {
      const rType = String(r.type || '').toUpperCase();
      if (rType !== filterType) return false;
    }
    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchDept = (r.department || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      return matchName || matchId || matchDept || matchDesc;
    }
    return true;
  });

  const getTierBadge = (tier: string) => {
    const t = String(tier || '').toUpperCase();
    if (t.includes('CRITICAL') || t.includes('RESTRICTED')) {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'rgba(185, 28, 28, 0.12)',
            color: '#b91c1c',
            border: '1px solid rgba(185, 28, 28, 0.25)',
          }}
        >
          Tier 1 Critical
        </span>
      );
    }
    if (t.includes('SENSITIVE') || t.includes('INTERNAL')) {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'rgba(180, 83, 9, 0.12)',
            color: '#b45309',
            border: '1px solid rgba(180, 83, 9, 0.25)',
          }}
        >
          Tier 2 Sensitive
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.2rem 0.55rem',
          borderRadius: '999px',
          background: 'rgba(21, 128, 61, 0.12)',
          color: '#15803d',
          border: '1px solid rgba(21, 128, 61, 0.25)',
        }}
      >
        Tier 3 Standard
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MODEL':
        return <Cpu size={18} color="var(--accent-crimson)" />;
      case 'DATASET':
        return <Database size={18} color="#7c3aed" />;
      default:
        return <Wrench size={18} color="#059669" />;
    }
  };

  const modelCount = resources.filter((r) => r.type === 'MODEL').length;
  const datasetCount = resources.filter((r) => r.type === 'DATASET').length;

  return (
    <div className="page-container" id="catalog-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title">Datasets & AI Models Catalog</h1>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {resources.length} Governed Assets
            </span>
          </div>
          <p className="page-subtitle">
            Catalog of AI models, datasets, and analytical tools under strict Separation-of-Duties (SoD) and limits governance.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${resources.length})` },
            { id: 'DATASET', label: `Datasets (${datasetCount})` },
            { id: 'MODEL', label: `AI Models (${modelCount})` },
          ].map((t) => (
            <button
              key={t.id}
              className={`btn btn-sm ${filterType === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterType(t.id)}
              id={`filter-${t.id.toLowerCase()}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Overview Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search datasets or models by name, ID, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            id="catalog-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem' }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>
            Showing <strong>{filtered.length}</strong> of {resources.length}
          </span>
          <button
            onClick={() => {
              setFilterType('ALL');
              setSearchQuery('');
            }}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem', background: '#ffffff' }}>
          <Layers className="animate-spin" size={28} color="var(--accent-crimson)" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading governed models and datasets...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', background: '#ffffff' }}>
          <Database size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            No Resources Found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            No models or datasets match your current filter and search query.
          </p>
          <button
            onClick={() => {
              setFilterType('ALL');
              setSearchQuery('');
            }}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filtered.map((res) => (
            <div
              key={res.id}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            >
              <div>
                {/* Header Row: Type & Tier Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getTypeIcon(res.type)}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {res.type}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-secondary)',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                      }}
                    >
                      {res.id}
                    </span>
                  </div>
                  {getTierBadge(res.tier)}
                </div>

                {/* Resource Title & Description */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', lineHeight: 1.3 }}>
                  {res.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', minHeight: '38px', lineHeight: 1.5 }}>
                  {res.description}
                </p>

                {/* Metadata Details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.8rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Department:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{res.department || 'General'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Max Duration:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <Clock size={13} color="var(--accent-crimson)" /> {res.max_duration_hours} hours
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Governance Routing:</span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        background: res.is_crucial ? 'rgba(185, 28, 28, 0.12)' : 'rgba(21, 128, 61, 0.12)',
                        color: res.is_crucial ? '#b91c1c' : '#15803d',
                      }}
                    >
                      {res.is_crucial ? '3-Stage Mandatory Review' : 'Manager Route'}
                    </span>
                  </div>

                  {/* Allowed Actions */}
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Approved Action Capabilities:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {res.allowed_actions && res.allowed_actions.length > 0 ? (
                        res.allowed_actions.map((act) => (
                          <span
                            key={act}
                            className="font-mono"
                            style={{
                              background: '#ffffff',
                              color: 'var(--text-primary)',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              fontWeight: 600,
                            }}
                          >
                            {act}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Standard query actions</span>
                      )}
                    </div>
                  </div>

                  {/* Required Controls */}
                  {res.required_controls && res.required_controls.length > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                        Safeguard Controls:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {res.required_controls.map((ctrl) => (
                          <span
                            key={ctrl}
                            style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              border: '1px solid #fde68a',
                              fontWeight: 600,
                            }}
                          >
                            {ctrl.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                }}
                onClick={() => navigate(`/requests/new?resource=${res.id}`)}
                id={`request-btn-${res.id}`}
              >
                <span>Request Access to {res.type === 'DATASET' ? 'Dataset' : 'Model'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
