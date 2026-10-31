import React, { useState } from 'react';
import { Search, Bell, ChevronDown, CheckCircle, ShieldAlert, ArrowRight, User, Shield, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SpiderWebDecor } from './SpiderWebDecor';
import { QuickSearchModal } from './QuickSearchModal';
import { useNavigate } from 'react-router-dom';

export const TopHeader: React.FC = () => {
  const { user, activePersonaId, personas, switchPersona, isNamoIDAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];
  const displayName = currentPersona.name || user?.display_name || 'Priya Sharma';
  const displayRole = currentPersona.id === 'priya' ? 'Requestor' : (currentPersona.role || 'Requestor');

  // Realistic mock notifications matching the image
  const notifications = [
    {
      id: 'n1',
      title: 'Security Alert: Join Blocked',
      desc: 'Blocked join attempt on Employee Records → Salary Records',
      time: '2h ago',
      type: 'alert',
      link: '/audit',
    },
    {
      id: 'n2',
      title: 'Pending Action: REQ-1042',
      desc: 'Customer Insights Dataset requested by Ananya Mehta',
      time: '2h ago',
      type: 'action',
      link: '/reviews',
    },
    {
      id: 'n3',
      title: 'Access Granted: Projects Dataset',
      desc: 'Read limits active for next 72 hours',
      time: '1d ago',
      type: 'info',
      link: '/grants',
    },
  ];

  return (
    <>
      <header className="top-header" id="top-header">
        {/* Search Pill Bar */}
        <div className="search-pill-wrapper">
          <button
            className="search-pill-btn"
            onClick={() => setIsSearchOpen(true)}
            id="global-search-trigger"
            aria-label="Search resources, requests, and datasets"
          >
            <Search size={15} className="search-pill-icon" />
            <span className="search-pill-text">Search datasets, models, users, or requests...</span>
            <kbd className="search-pill-kbd">⌘ K</kbd>
          </button>
        </div>

        {/* Right Header: Notification, User Profile, Spider Web */}
        <div className="top-header-right">
          {/* NamoID Auth Pill */}
          <button
            className="namoid-header-pill"
            onClick={() => navigate('/login')}
            title={isNamoIDAuthenticated ? `NamoID Verified: ${user?.sub}` : 'Sign in with NamoID Hosted Auth'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.785rem',
              fontWeight: 650,
              background: isNamoIDAuthenticated ? '#ecfdf5' : '#fef3c7',
              color: isNamoIDAuthenticated ? '#047857' : '#b45309',
              border: `1px solid ${isNamoIDAuthenticated ? '#a7f3d0' : '#fde68a'}`,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            id="top-header-namoid-btn"
          >
            <Shield size={13} color={isNamoIDAuthenticated ? '#10b981' : '#c2410c'} />
            <span>{isNamoIDAuthenticated ? (user?.display_name || user?.sub) : 'NamoID Sign In'}</span>
          </button>

          {/* Notifications Bell */}
          <div className="notif-wrapper">
            <button
              className={`notif-bell-btn ${isNotifOpen ? 'active' : ''}`}
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsUserMenuOpen(false);
              }}
              aria-label="View notifications and security alerts"
              id="notif-bell-btn"
            >
              <Bell size={18} />
              <span className="notif-badge-dot" />
            </button>

            {isNotifOpen && (
              <div className="notif-dropdown">
                <div className="notif-dropdown-header">
                  <span className="notif-header-title">Notifications & Security Alerts</span>
                  <span className="notif-unread-count">2 new</span>
                </div>
                <div className="notif-list">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className="notif-item"
                      onClick={() => {
                        navigate(item.link);
                        setIsNotifOpen(false);
                      }}
                    >
                      <div className={`notif-icon-box ${item.type}`}>
                        {item.type === 'alert' ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
                      </div>
                      <div className="notif-content">
                        <div className="notif-title-row">
                          <span className="notif-title">{item.title}</span>
                          <span className="notif-time">{item.time}</span>
                        </div>
                        <p className="notif-desc">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="notif-dropdown-footer">
                  <button
                    className="notif-view-all"
                    onClick={() => {
                      navigate('/audit');
                      setIsNotifOpen(false);
                    }}
                  >
                    View in Audit Chain <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill & Persona Switcher */}
          <div className="user-profile-wrapper">
            <button
              className={`user-profile-btn ${isUserMenuOpen ? 'active' : ''}`}
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsNotifOpen(false);
              }}
              id="user-profile-menu-btn"
              aria-expanded={isUserMenuOpen}
            >
              <div className="user-avatar-circle">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=120&auto=format&fit=crop"
                  alt={displayName}
                  className="user-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    const initials = parent?.querySelector('.user-avatar-initials') as HTMLElement;
                    if (initials) initials.style.display = 'flex';
                  }}
                  onLoad={(e) => {
                    const parent = e.currentTarget.parentElement;
                    const initials = parent?.querySelector('.user-avatar-initials') as HTMLElement;
                    if (initials) initials.style.display = 'none';
                  }}
                />
                <span className="user-avatar-initials" style={{ display: 'none' }}>
                  {displayName.split(' ').map((n) => n[0]).join('')}
                </span>
              </div>
              <div className="user-info-text">
                <span className="user-name">{displayName}</span>
                <span className="user-role">{displayRole}</span>
              </div>
              <ChevronDown size={14} className="user-chevron" />
            </button>

            {isUserMenuOpen && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <span className="menu-header-label">Switch Persona / Role</span>
                  <span className="menu-header-sub">Test multi-role governance in real time</span>
                </div>
                <div className="user-menu-personas">
                  {personas.map((p) => {
                    const isSelected = p.id === activePersonaId;
                    return (
                      <button
                        key={p.id}
                        className={`user-menu-persona-item ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          switchPersona(p.id);
                          setIsUserMenuOpen(false);
                        }}
                      >
                        <div className="menu-persona-left">
                          <span className="menu-persona-name">{p.name}</span>
                          <span className="menu-persona-desc">{p.description}</span>
                        </div>
                        <span className={`sidebar-role-badge ${p.badgeClass}`}>
                          {p.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {isNamoIDAuthenticated ? 'NamoID Connected' : 'NamoID Hosted Auth'}
                  </span>
                  {isNamoIDAuthenticated ? (
                    <button
                      onClick={() => { logout(); setIsUserMenuOpen(false); }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <LogOut size={12} />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { navigate('/login'); setIsUserMenuOpen(false); }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Lock size={12} />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Spider Web Hanging Motif (Corner accent) */}
          <SpiderWebDecor />
        </div>
      </header>

      {/* Global Quick Search Modal */}
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
