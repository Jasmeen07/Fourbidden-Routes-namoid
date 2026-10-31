import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Box, FileText, CheckSquare, Database, Shield, History, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCatalog = async () => {
      try {
        const res = await apiFetch('/api/resources');
        const list = Array.isArray(res) ? res : (res.resources || []);
        setResources(list);
      } catch (err) {
        // Fallback demo resources
        setResources([
          { id: 'ds_cust_insights', name: 'Customer Insights Dataset', type: 'DATASET', tier: 'TIER_2_SENSITIVE' },
          { id: 'ds_emp_records', name: 'Employee Records', type: 'DATASET', tier: 'TIER_1_CRITICAL' },
          { id: 'ds_salary_records', name: 'Salary Records', type: 'DATASET', tier: 'TIER_1_CRITICAL' },
          { id: 'mdl_marketing_llm', name: 'Marketing LLM Assistant', type: 'MODEL', tier: 'TIER_2_SENSITIVE' },
          { id: 'ds_projects', name: 'Projects Dataset', type: 'DATASET', tier: 'TIER_3_STANDARD' },
        ]);
      }
    };
    fetchCatalog();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickNav = [
    { name: 'Dashboard', path: '/dashboard', icon: Box, desc: 'Intentional access overview & graph' },
    { name: 'Access Requests', path: '/requests', icon: FileText, desc: 'Create and track access submissions' },
    { name: 'Approvals Queue', path: '/reviews', icon: CheckSquare, desc: 'Multi-role reviews & limit narrowing' },
    { name: 'Datasets & Models', path: '/catalog', icon: Database, desc: 'Browse enterprise resource catalog' },
    { name: 'Relationship View', path: '/relationships', icon: Shield, desc: 'Interactive graph & SoD separation' },
    { name: 'Audit Logs', path: '/audit', icon: History, desc: 'SHA-256 tamper-evident log chain' },
  ];

  const filteredResources = resources.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) || r.id.toLowerCase().includes(query.toLowerCase())
  );

  const filteredNav = quickNav.filter((n) =>
    n.name.toLowerCase().includes(query.toLowerCase()) || n.desc.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="search-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <Search size={18} className="search-modal-icon" />
          <input
            type="text"
            className="search-modal-input"
            placeholder="Search datasets, models, users, or requests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="search-modal-close" onClick={onClose} aria-label="Close search modal">
            <X size={18} />
          </button>
        </div>

        <div className="search-modal-body">
          {query.trim() === '' && (
            <div className="search-section">
              <span className="search-section-title">QUICK NAVIGATION</span>
              <div className="search-results-list">
                {quickNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      className="search-result-item"
                      onClick={() => handleSelect(item.path)}
                    >
                      <div className="search-item-icon">
                        <Icon size={16} />
                      </div>
                      <div className="search-item-info">
                        <span className="search-item-title">{item.name}</span>
                        <span className="search-item-sub">{item.desc}</span>
                      </div>
                      <ArrowRight size={14} className="search-item-arrow" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {query.trim() !== '' && (
            <>
              {filteredNav.length > 0 && (
                <div className="search-section">
                  <span className="search-section-title">SECTIONS</span>
                  <div className="search-results-list">
                    {filteredNav.map((item) => (
                      <button
                        key={item.path}
                        className="search-result-item"
                        onClick={() => handleSelect(item.path)}
                      >
                        <div className="search-item-info">
                          <span className="search-item-title">{item.name}</span>
                          <span className="search-item-sub">{item.desc}</span>
                        </div>
                        <ArrowRight size={14} className="search-item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="search-section">
                <span className="search-section-title">MATCHING RESOURCES</span>
                {filteredResources.length === 0 ? (
                  <p className="search-empty">No resources matched "{query}"</p>
                ) : (
                  <div className="search-results-list">
                    {filteredResources.map((res) => (
                      <button
                        key={res.id}
                        className="search-result-item"
                        onClick={() => handleSelect(`/requests/new?resource=${res.id}`)}
                      >
                        <div className="search-item-icon">
                          <Database size={16} />
                        </div>
                        <div className="search-item-info">
                          <span className="search-item-title">{res.name}</span>
                          <span className="search-item-sub font-mono">{res.id} · {res.tier || 'STANDARD'}</span>
                        </div>
                        <span className="search-item-action">Request Access →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="search-modal-footer">
          <span>Navigate with mouse or keyboard</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
