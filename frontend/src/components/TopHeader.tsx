import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  CheckCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  User,
  Shield,
  Lock,
  LogOut,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SpiderWebDecor } from './SpiderWebDecor';
import { QuickSearchModal } from './QuickSearchModal';
import { useNavigate } from 'react-router-dom';
import { GovernanceNotification } from '../types';

function formatTimeAgo(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

export const TopHeader: React.FC = () => {
  const { user, activePersonaId, personas, switchPersona, isNamoIDAuthenticated, logout, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<GovernanceNotification[]>([]);

  const loadNotifications = async () => {
    try {
      const data = await apiFetch('/api/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => clearInterval(interval);
  }, [activePersonaId, user?.sub]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch('/api/notifications/clear', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];
  const displayName = currentPersona.name || user?.display_name || 'Priya Sharma';
  const displayRole = currentPersona.id === 'priya' ? 'Requestor' : (currentPersona.role || 'Requestor');
  const unreadCount = notifications.filter((n) => !n.read).length;


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
                if (!isNotifOpen) loadNotifications();
              }}
              aria-label="View notifications and security alerts"
              id="notif-bell-btn"
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span
                  className="notif-badge-dot"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    width: unreadCount > 9 ? '18px' : '15px',
                    height: '15px',
                    borderRadius: '9999px',
                    top: '2px',
                    right: '2px',
                    background: '#dc2626',
                    border: '1.5px solid #ffffff',
                  }}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {isNotifOpen && (
              <div className="notif-dropdown">
                <div className="notif-dropdown-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="notif-header-title">Notifications & Security Alerts</span>
                    {unreadCount > 0 && <span className="notif-unread-count">{unreadCount} new</span>}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.72rem',
                        color: 'var(--accent-wine)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const isApproved = item.kind === 'REQUEST_APPROVED';
                      const isRejected = item.kind === 'REQUEST_REJECTED';
                      const isAlert = item.kind === 'SECURITY_ALERT';
                      const iconBoxClass = isApproved ? 'approved' : isRejected ? 'rejected' : isAlert ? 'alert' : 'info';

                      return (
                        <div
                          key={item.id}
                          className={`notif-item ${!item.read ? 'unread' : ''}`}
                          onClick={() => {
                            if (isApproved && item.grant_id) {
                              navigate('/grants');
                            } else if (item.request_id) {
                              navigate('/requests');
                            } else {
                              navigate('/audit');
                            }
                            setIsNotifOpen(false);
                          }}
                        >
                          <div className={`notif-icon-box ${iconBoxClass}`}>
                            {isApproved ? (
                              <CheckCircle2 size={16} />
                            ) : isRejected ? (
                              <XCircle size={16} />
                            ) : (
                              <ShieldAlert size={16} />
                            )}
                          </div>

                          <div className="notif-content">
                            <div className="notif-title-row">
                              <span className="notif-title">
                                {item.title || (isApproved ? 'Access Request Approved' : isRejected ? 'Access Request Rejected' : 'Security Alert')}
                              </span>
                              <span className="notif-time">{formatTimeAgo(item.created_at)}</span>
                            </div>

                            {item.resource_name && (
                              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.15rem 0' }}>
                                Resource: {item.resource_name}
                              </div>
                            )}

                            <p className="notif-desc">{item.message}</p>

                            {/* Summary type notification: Breakdown of who accepted and who rejected and why */}
                            {item.summary_breakdown && item.summary_breakdown.length > 0 && (
                              <div className="notif-summary-box">
                                <div className="notif-summary-header">Governance Decision Trail:</div>
                                {item.summary_breakdown.map((slot, sIdx) => {
                                  const decLower = (slot.decision || '').toLowerCase();
                                  return (
                                    <div key={sIdx} className="notif-summary-slot">
                                      <div className="notif-slot-role-row">
                                        <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
                                          {slot.reviewer_name}{' '}
                                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({slot.slot_role})</span>
                                        </span>
                                        <span className={`notif-decision-pill ${decLower}`}>
                                          {slot.decision}
                                        </span>
                                      </div>
                                      {slot.rationale && (
                                        <div className="notif-slot-why">
                                          "{slot.rationale}"
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Action Buttons Row */}
                            <div className="notif-actions-row">
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {isApproved && (
                                  <button
                                    className="notif-cta-btn primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate('/grants');
                                      setIsNotifOpen(false);
                                    }}
                                  >
                                    <span>View Active Grant</span>
                                    <ArrowRight size={11} />
                                  </button>
                                )}
                                {isRejected && (
                                  <button
                                    className="notif-cta-btn"
                                    style={{ borderColor: '#fca5a5', color: '#b91c1c' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate('/requests');
                                      setIsNotifOpen(false);
                                    }}
                                  >
                                    <span>Inspect Request Audit</span>
                                    <ArrowRight size={11} />
                                  </button>
                                )}
                              </div>

                              {!item.read && (
                                <button
                                  className="notif-cta-btn"
                                  onClick={(e) => handleMarkRead(item.id, e)}
                                  title="Mark notification as read"
                                >
                                  <Check size={11} />
                                  <span>Read</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="notif-dropdown-footer">
                  <button
                    className="notif-view-all"
                    onClick={() => {
                      navigate('/audit');
                      setIsNotifOpen(false);
                    }}
                  >
                    <span>View Immutable Audit Chain</span>
                    <ArrowRight size={13} />
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
