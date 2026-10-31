import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccessRequest } from '../types';
import { 
  ArrowRight, 
  FileText, 
  Database, 
  Folder
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activePersonaId, personas, apiFetch } = useAuth();
  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];
  const firstName = (currentPersona.name || user?.display_name || 'Priya').split(' ')[0].toUpperCase();

  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const reqData = await apiFetch('/api/requests?view=visible');
        const list = Array.isArray(reqData) ? reqData : (reqData.requests || []);
        setPendingRequests(list.filter((r: any) => r.status === 'IN_REVIEW' || r.status === 'BLOCKED'));
      } catch (err) {
        // Fallback gracefully
      }
    };
    loadDashboardData();
  }, [user]);

  // Node details for interactive graph
  const nodeDetails: Record<string, { title: string; type: string; status: string; detail: string; tier: string }> = {
    employee: {
      title: 'Employee Records',
      type: 'Primary Dataset',
      status: 'Access granted',
      tier: 'Tier 1 Critical',
      detail: 'Read permission active under ML_ENGINEER role. Schema includes employee IDs, team alignments, and tenure metrics.',
    },
    client: {
      title: 'Client Data',
      type: 'Anonymized Dataset',
      status: 'Access granted',
      tier: 'Tier 2 Sensitive',
      detail: 'Synthetic client telemetry for churn model evaluation. Masked PII controls active.',
    },
    projects: {
      title: 'Projects Dataset',
      type: 'Internal Repository',
      status: 'Access granted',
      tier: 'Tier 3 Standard',
      detail: 'Sprint deliverables, task assignees, and engineering project milestones.',
    },
    salary: {
      title: 'Salary Records',
      type: 'Restricted Financials',
      status: 'Restricted',
      tier: 'Tier 1 Critical',
      detail: 'Join blocked by Separation-of-Duties (SoD). Dual executive approval required to correlate with Employee Records.',
    },
    reviews: {
      title: 'Performance Reviews',
      type: 'Confidential HR',
      status: 'Not authorised',
      tier: 'Tier 1 Critical',
      detail: 'Direct access denied. Indirect inference paths through project assignees are monitored and blocked in real-time.',
    },
  };

  return (
    <div className="dashboard-page" id="dashboard-root">
      {/* 1. Hero Intent Section with Interactive Relationship Graph */}
      <section className="dashboard-hero-section">
        {/* Left Hero Statement */}
        <div className="hero-text-block">
          <p className="hero-eyebrow" id="hero-greeting">
            GOOD MORNING, {firstName}
          </p>
          <h1 className="hero-heading">
            Access should be<br />
            intentional.<br />
            <span className="hero-heading-highlight">Not assumed.</span>
          </h1>
          <p className="hero-subtext">
            Request, review and govern access to data and AI resources — with built-in security, risk awareness and relationship protection.
          </p>
          <div className="hero-cta-wrapper">
            <button
              className="btn-crimson-hero"
              onClick={() => navigate('/requests/new')}
              id="hero-request-access-btn"
            >
              <span>Request Access</span>
              <ArrowRight size={16} className="hero-cta-arrow" />
            </button>
          </div>
        </div>

        {/* Right Hero Visual: Interactive Relationship Graph */}
        <div className="hero-graph-block" id="relationship-graph-hero">
          {/* Subtle dotted grid aura canvas */}
          <div className="graph-dotted-aura" aria-hidden="true" />

          {/* SVG Canvas for Relationship Paths */}
          <svg className="graph-svg-canvas" viewBox="0 0 640 380" fill="none">
            {/* Background dot matrix */}
            <defs>
              <pattern id="dot-matrix" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.0" fill="rgba(200, 160, 150, 0.28)" />
              </pattern>
            </defs>
            <rect width="640" height="380" fill="url(#dot-matrix)" />

            {/* Connecting Lines */}
            {/* 1. Employee Records (305, 175) -> Client Data (130, 295): Indirect Relationship (Grey dashed) */}
            <path
              d="M 285 195 Q 210 240 150 280"
              stroke="#6b7280"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              className="graph-path indirect-path"
            />

            {/* 2. Employee Records (305, 175) -> Projects (410, 295): Model Dependency (Dark slate dashed) */}
            <path
              d="M 325 195 Q 365 240 395 280"
              stroke="#475569"
              strokeWidth="1.6"
              strokeDasharray="5,4"
              className="graph-path model-path"
            />

            {/* 3. Employee Records (305, 175) -> Salary Records (435, 65): Foreign Key (Red dashed with glowing alert dot) */}
            <path
              d="M 325 155 Q 375 105 415 75"
              stroke="#e11d48"
              strokeWidth="1.75"
              strokeDasharray="4,3"
              className="graph-path foreign-key-path"
            />
            {/* Animated alert dot traversing the blocked foreign key path */}
            <circle cx="370" cy="115" r="3" fill="#ef4444" className="pulse-alert-dot" />

            {/* 4. Employee Records (305, 175) -> Performance Reviews (525, 175): Indirect Relationship */}
            <path
              d="M 335 175 L 495 175"
              stroke="#6b7280"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              className="graph-path indirect-path"
            />
          </svg>

          {/* Interactive Graph Nodes positioned absolutely over canvas */}
          <div className="graph-nodes-container">
            {/* Node 1: Employee Records (Center - Green/Granted) */}
            <div
              className={`graph-node-anchor node-center ${activeNode === 'employee' ? 'node-focused' : ''}`}
              style={{ left: '47.5%', top: '46%' }}
              onClick={() => setActiveNode(activeNode === 'employee' ? null : 'employee')}
              title="Click to view relationship safeguards"
            >
              <div className="node-glow-ring ring-green" />
              <div className="node-core core-green">
                <Database size={15} color="#ffffff" />
              </div>
              <div className="node-label-group">
                <span className="node-name">Employee Records</span>
                <span className="node-pill pill-green">Access granted</span>
              </div>
            </div>

            {/* Node 2: Client Data (Bottom Left - Green/Granted) */}
            <div
              className={`graph-node-anchor node-client ${activeNode === 'client' ? 'node-focused' : ''}`}
              style={{ left: '20%', top: '78%' }}
              onClick={() => setActiveNode(activeNode === 'client' ? null : 'client')}
            >
              <div className="node-glow-ring ring-green" />
              <div className="node-core core-green">
                <FileText size={14} color="#ffffff" />
              </div>
              <div className="node-label-group">
                <span className="node-name">Client Data</span>
                <span className="node-pill pill-green">Access granted</span>
              </div>
            </div>

            {/* Node 3: Projects (Bottom Right - Green/Granted) */}
            <div
              className={`graph-node-anchor node-projects ${activeNode === 'projects' ? 'node-focused' : ''}`}
              style={{ left: '64%', top: '78%' }}
              onClick={() => setActiveNode(activeNode === 'projects' ? null : 'projects')}
            >
              <div className="node-glow-ring ring-green" />
              <div className="node-core core-green">
                <Folder size={14} color="#ffffff" />
              </div>
              <div className="node-label-group">
                <span className="node-name">Projects</span>
                <span className="node-pill pill-green">Access granted</span>
              </div>
            </div>

            {/* Node 4: Salary Records (Top Right - Red/Restricted) */}
            <div
              className={`graph-node-anchor node-salary ${activeNode === 'salary' ? 'node-focused' : ''}`}
              style={{ left: '68%', top: '17%' }}
              onClick={() => setActiveNode(activeNode === 'salary' ? null : 'salary')}
            >
              <div className="node-glow-ring ring-red" />
              <div className="node-core core-red">
                <Database size={14} color="#ffffff" />
              </div>
              <div className="node-label-group">
                <span className="node-name">Salary Records</span>
                <span className="node-pill pill-red">Restricted</span>
              </div>
            </div>

            {/* Node 5: Performance Reviews (Middle Right - Red/Not authorised) */}
            <div
              className={`graph-node-anchor node-reviews ${activeNode === 'reviews' ? 'node-focused' : ''}`}
              style={{ left: '82%', top: '46%' }}
              onClick={() => setActiveNode(activeNode === 'reviews' ? null : 'reviews')}
            >
              <div className="node-glow-ring ring-red" />
              <div className="node-core core-red">
                <FileText size={14} color="#ffffff" />
              </div>
              <div className="node-label-group">
                <span className="node-name">Performance Reviews</span>
                <span className="node-pill pill-red">Not authorised</span>
              </div>
            </div>
          </div>

          {/* Node Detail Popup when clicked */}
          {activeNode && nodeDetails[activeNode] && (
            <div className="graph-node-inspector" role="dialog" aria-label="Node Details">
              <div className="inspector-header">
                <div>
                  <span className="inspector-tier">{nodeDetails[activeNode].tier}</span>
                  <h4 className="inspector-title">{nodeDetails[activeNode].title}</h4>
                </div>
                <button
                  className="inspector-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveNode(null);
                  }}
                >
                  ✕
                </button>
              </div>
              <p className="inspector-detail">{nodeDetails[activeNode].detail}</p>
              <div className="inspector-footer">
                <button
                  className="inspector-action"
                  onClick={() => navigate('/relationships')}
                >
                  Open Full Relationship Map →
                </button>
              </div>
            </div>
          )}

          {/* Graph Legend (Bottom Right, matching image) */}
          <div className="graph-legend-box" aria-label="Graph Legend">
            <div className="legend-row">
              <span className="legend-dot dot-green" />
              <span className="legend-label">Your access</span>
            </div>
            <div className="legend-row">
              <span className="legend-dot dot-red" />
              <span className="legend-label">Restricted</span>
            </div>
            <div className="legend-row">
              <span className="legend-line line-indirect" />
              <span className="legend-label">Indirect relationship</span>
            </div>
            <div className="legend-row">
              <span className="legend-line line-fk" />
              <span className="legend-label">Foreign key</span>
            </div>
            <div className="legend-row">
              <span className="legend-line line-model" />
              <span className="legend-label">Model dependency</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Middle Section: "Pending for Your Action" */}
      <section className="dashboard-section pending-action-section">
        <div className="section-header-row">
          <h2 className="section-serif-heading">Pending for Your Action</h2>
          <button
            className="section-link-btn"
            onClick={() => navigate('/reviews')}
            id="view-all-requests-link"
          >
            <span>View all requests</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Canonical Request Card matching image */}
        <div className="pending-cards-grid">
          <div
            className="pending-action-card"
            onClick={() => navigate('/reviews')}
            id="card-req-1042"
          >
            <div className="action-card-left">
              <div className="action-icon-box">
                <FileText size={20} color="#b91c1c" />
              </div>
              <div className="action-info">
                <span className="action-req-code font-mono">REQ-1042</span>
                <h3 className="action-req-title">Customer Insights Dataset</h3>
                <p className="action-req-author">Requested by Ananya Mehta</p>
              </div>
            </div>

            <div className="action-card-right">
              <span className="badge-risk-high">High</span>
              <div className="action-status-meta">
                <span className="action-status-text">Needs your review</span>
                <span className="action-time-text">2h ago</span>
              </div>
              <button
                className="action-circle-btn"
                aria-label="Review Request REQ-1042"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/reviews');
                }}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* If there are additional real pending requests, show them */}
          {pendingRequests
            .filter((r) => r.id !== 'REQ-1042')
            .slice(0, 2)
            .map((req) => (
              <div
                key={req.id}
                className="pending-action-card"
                onClick={() => navigate('/reviews')}
              >
                <div className="action-card-left">
                  <div className="action-icon-box">
                    <FileText size={20} color="#b91c1c" />
                  </div>
                  <div className="action-info">
                    <span className="action-req-code font-mono">{req.id}</span>
                    <h3 className="action-req-title">{req.resource_name || req.resource_id}</h3>
                    <p className="action-req-author">Requested by {req.requester_name || req.requester_sub || req.requester_id}</p>
                  </div>
                </div>

                <div className="action-card-right">
                  <span className={`badge-risk-${req.resource_tier === 'TIER_1_CRITICAL' ? 'high' : 'medium'}`}>
                    {req.resource_tier === 'TIER_1_CRITICAL' ? 'Critical' : 'Standard'}
                  </span>
                  <div className="action-status-meta">
                    <span className="action-status-text">Pending approval</span>
                    <span className="action-time-text">Active queue</span>
                  </div>
                  <button
                    className="action-circle-btn"
                    aria-label={`Review ${req.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/reviews');
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* 3. Bottom Split Section: Recent Activity (Left) + Prevent Indirect Access Callout (Right) */}
      <section className="dashboard-bottom-grid">
        {/* Left Column: Recent Activity Timeline */}
        <div className="recent-activity-card">
          <div className="activity-card-header">
            <h2 className="section-serif-heading">Recent Activity</h2>
          </div>

          <div className="activity-timeline">
            {/* Timeline Item 1: Security Alert (Red) */}
            <div className="timeline-item">
              <div className="timeline-marker">
                <span className="timeline-dot dot-crimson" />
                <span className="timeline-line" />
              </div>
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="timeline-text">
                    Blocked join attempt on <strong>Employee Records → Salary Records</strong>
                  </span>
                  <span className="badge-security-alert">Security Alert</span>
                </div>
                <span className="timeline-time">2 hours ago</span>
              </div>
            </div>

            {/* Timeline Item 2: Access Granted (Green) */}
            <div className="timeline-item">
              <div className="timeline-marker">
                <span className="timeline-dot dot-forest" />
                <span className="timeline-line" />
              </div>
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="timeline-text">
                    Access granted: <strong>Projects Dataset (Read)</strong>
                  </span>
                </div>
                <span className="timeline-time">1 day ago</span>
              </div>
            </div>

            {/* Timeline Item 3: Review requested (Amber) */}
            <div className="timeline-item">
              <div className="timeline-marker">
                <span className="timeline-dot dot-amber" />
              </div>
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="timeline-text">
                    Review requested for <strong>Marketing LLM</strong>
                  </span>
                </div>
                <span className="timeline-time">2 days ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Editorial Philosophy Callout Card */}
        <div className="editorial-callout-card" id="callout-indirect-access">
          <div className="callout-inner">
            <h3 className="callout-heading">
              Prevent indirect access.<br />
              <span className="callout-heading-highlight">By design.</span>
            </h3>
            <p className="callout-text">
              All dataset relationships are checked in real time — so access to one resource never leads to unauthorised access to another.
            </p>
            <div className="callout-footer">
              <button
                className="callout-link-btn"
                onClick={() => navigate('/relationships')}
                id="explore-relationships-link"
              >
                <span>Explore Relationship View</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
