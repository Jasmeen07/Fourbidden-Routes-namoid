import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Layers, FileText, CheckSquare, Key, Terminal, History, BookOpen, User, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, activePersonaId, personas, switchPersona, isNamoIDAuthenticated, logout } = useAuth();
  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];

  return (
    <header className="header-nav">
      <div className="nav-inner">
        <NavLink to="/catalog" className="brand" id="brand-logo">
          <div className="brand-icon">
            <Shield size={19} />
          </div>
          <span>GrantGate</span>
          <span className="brand-tag">Governance</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '0.15rem 0.45rem', borderRadius: '9999px', letterSpacing: '0.04em' }}>
            TEST
          </span>
        </NavLink>

        <nav className="nav-links">
          <NavLink to="/catalog" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-catalog">
            <Layers size={15} />
            <span>Catalog</span>
          </NavLink>

          <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-requests">
            <FileText size={15} />
            <span>Requests</span>
          </NavLink>

          <NavLink to="/reviews" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-reviews">
            <CheckSquare size={15} />
            <span>Review Queue</span>
          </NavLink>

          <NavLink to="/grants" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-grants">
            <Key size={15} />
            <span>Active Grants</span>
          </NavLink>

          <NavLink to="/simulator" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-simulator">
            <Terminal size={15} />
            <span>PEP Simulator</span>
          </NavLink>

          <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-audit">
            <History size={15} />
            <span>Audit Chain</span>
          </NavLink>

          <NavLink to="/policy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-policy">
            <BookOpen size={15} />
            <span>Policy</span>
          </NavLink>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* NamoID Authentication State / Action */}
          {isNamoIDAuthenticated ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.25rem 0.65rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              color: '#047857',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontWeight: 650 }}>NamoID: {user?.display_name || user?.sub}</span>
              <button
                onClick={() => logout()}
                title="Sign out of NamoID session"
                style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 0.15rem' }}
                aria-label="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.785rem',
                fontWeight: 650,
                padding: '0.32rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                textDecoration: 'none',
                transition: 'var(--transition-fast)',
              }}
              id="nav-namoid-login"
            >
              <Lock size={12} />
              <span>NamoID Sign In</span>
            </NavLink>
          )}

          {/* Persona Switcher for evaluation / testing */}
          <div className="user-switcher" id="user-switcher" title="Switch active persona for multi-role evaluation">
            <User size={15} color="#78716c" />
            <select
              className="persona-selector"
              value={activePersonaId}
              onChange={(e) => switchPersona(e.target.value)}
              id="persona-select"
              aria-label="Select evaluation persona"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
            <span className={`role-chip ${currentPersona.badgeClass}`} id="user-role-badge">
              {currentPersona.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
