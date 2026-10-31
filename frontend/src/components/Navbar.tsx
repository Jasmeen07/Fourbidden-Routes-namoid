import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Layers, FileText, CheckSquare, Key, Terminal, History, BookOpen, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, activePersonaId, personas, switchPersona } = useAuth();
  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];

  return (
    <header className="header-nav">
      <div className="nav-inner">
        <NavLink to="/catalog" className="brand" id="brand-logo">
          <div className="brand-icon">
            <Shield size={20} />
          </div>
          <span>GrantGate</span>
          <span className="brand-tag">Governance</span>
        </NavLink>

        <nav className="nav-links">
          <NavLink to="/catalog" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-catalog">
            <Layers size={16} />
            <span>Catalog</span>
          </NavLink>

          <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-requests">
            <FileText size={16} />
            <span>Requests</span>
          </NavLink>

          <NavLink to="/reviews" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-reviews">
            <CheckSquare size={16} />
            <span>Reviews</span>
          </NavLink>

          <NavLink to="/grants" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-grants">
            <Key size={16} />
            <span>Active Grants</span>
          </NavLink>

          <NavLink to="/simulator" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-simulator">
            <Terminal size={16} />
            <span>PEP Simulator</span>
          </NavLink>

          <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-audit">
            <History size={16} />
            <span>Audit Chain</span>
          </NavLink>

          <NavLink to="/policy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-policy">
            <BookOpen size={16} />
            <span>Policy</span>
          </NavLink>
        </nav>

        <div className="user-switcher" id="user-switcher">
          <User size={15} color="#94a3b8" />
          <select
            className="persona-selector"
            value={activePersonaId}
            onChange={(e) => switchPersona(e.target.value)}
            id="persona-select"
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
    </header>
  );
};
