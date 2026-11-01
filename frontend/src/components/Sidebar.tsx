import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  CheckSquare,
  Box,
  Share2,
  Database,
  ShieldCheck,
  History,
  Terminal,
  UserCheck,
  Lock,
  Users,
  Radio,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { activePersonaId, personas, switchPersona, apiFetch, user } = useAuth();
  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];
  const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState<number>(0);
  const [activeGrantsCount, setActiveGrantsCount] = React.useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const reqData = await apiFetch('/api/requests?view=visible');
        const reqList: any[] = Array.isArray(reqData) ? reqData : (reqData.requests || []);
        let pCount = 0;
        for (const r of reqList) {
          if (r.status === 'IN_REVIEW' || r.status === 'BLOCKED') {
            const pendingSlots = (r.slots || []).filter((s: any) => s.status === 'PENDING');
            pCount += pendingSlots.length;
          }
        }
        if (isMounted) setPendingApprovalsCount(pCount);

        const grantData = await apiFetch('/api/grants?status=active&scope=visible');
        const grantList: any[] = Array.isArray(grantData) ? grantData : (grantData.grants || []);
        const aCount = grantList.filter((g: any) => (g.effective_status || g.status) === 'ACTIVE').length;
        if (isMounted) setActiveGrantsCount(aCount);
      } catch {
        // Ignore background polling errors
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activePersonaId, user, location.pathname]);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Home, matchPaths: ['/', '/dashboard'] },
    { label: 'SecOps & WAF Defense', path: '/secops', icon: ShieldAlert, matchPaths: ['/secops'] },
    { label: 'My Access & Security', path: '/hierarchy', icon: ShieldCheck, matchPaths: ['/hierarchy'] },
    { label: 'AI Security Command Center', path: '/provenance', icon: Activity, matchPaths: ['/provenance'] },
    { label: 'Access Requests', path: '/requests', icon: FileText, matchPaths: ['/requests', '/requests/new'] },
    {
      label: 'Approvals',
      path: '/reviews',
      icon: CheckSquare,
      matchPaths: ['/reviews'],
      badge: pendingApprovalsCount,
      badgeStyle: { background: '#e11d48' },
    },
    { label: 'Datasets & Models', path: '/catalog', icon: Box, matchPaths: ['/catalog'] },
    { label: 'Relationship View', path: '/relationships', icon: Share2, matchPaths: ['/relationships'] },
    {
      label: 'Active Grants',
      path: '/grants',
      icon: Database,
      matchPaths: ['/grants'],
      badge: activeGrantsCount,
      badgeStyle: { background: '#059669' },
    },
    { label: 'Risk & Compliance', path: '/policy', icon: ShieldCheck, matchPaths: ['/policy'] },
    { label: 'Audit Logs', path: '/audit', icon: History, matchPaths: ['/audit'] },
    { label: 'PEP Simulator', path: '/simulator', icon: Terminal, matchPaths: ['/simulator'] },
    { label: 'NamoID Auth', path: '/login', icon: Lock, matchPaths: ['/login'] },
  ];

  return (
    <aside className="sidebar-container" id="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-wrapper">
        <NavLink to="/dashboard" className="sidebar-brand" id="brand-home-link">
          {/* GrantGate 8-pointed star compass logo */}
          <div className="brand-star-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M14 0L16.2 10.5L24 5.5L18.5 13.5L28 14L18.5 16.5L24 22.5L16.2 17.5L14 28L11.8 17.5L4 22.5L9.5 16.5L0 14L9.5 13.5L4 5.5L11.8 10.5L14 0Z"
                fill="url(#star-grad)"
              />
              <circle cx="14" cy="14" r="2.2" fill="#fff" />
              <defs>
                <linearGradient id="star-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#e27364" />
                  <stop offset="0.5" stopColor="#c53b3b" />
                  <stop offset="1" stopColor="#7a161d" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text-group">
            <span className="brand-title">GrantGate</span>
            <span className="brand-tagline">ACCESS WITH INTENT</span>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPaths.includes(location.pathname);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <div className="nav-item-icon-wrap">
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
              </div>
              <span className="nav-item-label">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="sidebar-nav-badge" style={item.badgeStyle}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Lower Sidebar Decorative Constellation Web & Mission Footer */}
      <div className="sidebar-footer">
        {/* Constellation web vector lines */}
        <div className="sidebar-web-bg" aria-hidden="true">
          <svg width="220" height="150" viewBox="0 0 220 150" fill="none">
            <g stroke="rgba(196, 65, 75, 0.18)" strokeWidth="0.8">
              <line x1="0" y1="150" x2="110" y2="70" />
              <line x1="0" y1="120" x2="150" y2="90" />
              <line x1="30" y1="150" x2="80" y2="40" />
              <line x1="80" y1="40" x2="160" y2="50" />
              <line x1="110" y1="70" x2="200" y2="120" />
              <line x1="160" y1="50" x2="210" y2="90" />
              <line x1="80" y1="40" x2="110" y2="70" />
              <line x1="150" y1="90" x2="200" y2="120" />
            </g>
            {/* Glowing red constellation nodes */}
            <circle cx="80" cy="40" r="2.5" fill="#e11d48" opacity="0.6" />
            <circle cx="110" cy="70" r="2" fill="#ef4444" opacity="0.8" />
            <circle cx="160" cy="50" r="2.5" fill="#f87171" opacity="0.5" />
            <circle cx="150" cy="90" r="2" fill="#ef4444" opacity="0.7" />
            <circle cx="200" cy="120" r="2.5" fill="#e11d48" opacity="0.6" />
          </svg>
        </div>

        {/* Quick Persona Evaluator Switcher */}
        <div className="sidebar-persona-card" title="Switch persona to test multi-role governance">
          <div className="persona-card-header">
            <UserCheck size={14} className="persona-card-icon" />
            <span className="persona-card-title">EVALUATION PERSONA</span>
          </div>
          <select
            className="sidebar-persona-select"
            value={activePersonaId}
            onChange={(e) => switchPersona(e.target.value)}
            id="sidebar-persona-dropdown"
            aria-label="Select evaluation persona"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
          <div className="persona-meta">
            <span className={`sidebar-role-badge ${currentPersona.badgeClass}`}>
              {currentPersona.role}
            </span>
            <span className="persona-test-tag">TESTBED</span>
          </div>
        </div>

        {/* Vertical/Tracked Label */}
        <div className="sidebar-motto">
          <span>MONITOR</span>
          <span>GOVERN</span>
          <span>PROTECT</span>
        </div>
      </div>
    </aside>
  );
};
