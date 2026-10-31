import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Share2, 
  Database, 
  Cpu, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  Terminal, 
  Filter,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  tier: string;
  type: 'DATASET' | 'MODEL';
  access: 'GRANTED' | 'RESTRICTED' | 'NOT_AUTHORISED';
  x: number;
  y: number;
  connections: { targetId: string; type: 'FK' | 'INDIRECT' | 'DEPENDENCY'; blocked: boolean; rule: string }[];
}

export const RelationshipViewPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<string>('emp_records');
  const [filterConnection, setFilterConnection] = useState<string>('ALL');
  const [simSource, setSimSource] = useState<string>('emp_records');
  const [simTarget, setSimTarget] = useState<string>('salary_records');
  const [simResult, setSimResult] = useState<{ allowed: boolean; reason: string; rule: string } | null>(null);

  const nodes: Record<string, GraphNode> = {
    emp_records: {
      id: 'emp_records',
      name: 'Employee Records',
      tier: 'Tier 1 Critical',
      type: 'DATASET',
      access: 'GRANTED',
      x: 280,
      y: 190,
      connections: [
        { targetId: 'salary_records', type: 'FK', blocked: true, rule: 'SoD Separation: Employee identity cannot join with compensation data without executive approval' },
        { targetId: 'client_data', type: 'INDIRECT', blocked: false, rule: 'Indirect relationship: Masked account telemetry allowed under ML_ENGINEER scope' },
        { targetId: 'projects_data', type: 'DEPENDENCY', blocked: false, rule: 'Direct sprint resource mapping allowed' },
        { targetId: 'perf_reviews', type: 'INDIRECT', blocked: true, rule: 'SoD Separation: Performance evaluations restricted to HR Compliance' },
      ],
    },
    client_data: {
      id: 'client_data',
      name: 'Client Data',
      tier: 'Tier 2 Sensitive',
      type: 'DATASET',
      access: 'GRANTED',
      x: 130,
      y: 310,
      connections: [
        { targetId: 'cust_insights', type: 'DEPENDENCY', blocked: false, rule: 'Customer segmentation feed allowed' },
      ],
    },
    projects_data: {
      id: 'projects_data',
      name: 'Projects Dataset',
      tier: 'Tier 3 Standard',
      type: 'DATASET',
      access: 'GRANTED',
      x: 430,
      y: 310,
      connections: [
        { targetId: 'marketing_llm', type: 'DEPENDENCY', blocked: false, rule: 'Model context fine-tuning pipeline' },
      ],
    },
    salary_records: {
      id: 'salary_records',
      name: 'Salary Records',
      tier: 'Tier 1 Critical',
      type: 'DATASET',
      access: 'RESTRICTED',
      x: 450,
      y: 80,
      connections: [],
    },
    perf_reviews: {
      id: 'perf_reviews',
      name: 'Performance Reviews',
      tier: 'Tier 1 Critical',
      type: 'DATASET',
      access: 'NOT_AUTHORISED',
      x: 520,
      y: 200,
      connections: [],
    },
    marketing_llm: {
      id: 'marketing_llm',
      name: 'Marketing LLM Assistant',
      tier: 'Tier 2 Sensitive',
      type: 'MODEL',
      access: 'GRANTED',
      x: 520,
      y: 370,
      connections: [],
    },
    cust_insights: {
      id: 'cust_insights',
      name: 'Customer Insights Dataset',
      tier: 'Tier 2 Sensitive',
      type: 'DATASET',
      access: 'RESTRICTED',
      x: 80,
      y: 400,
      connections: [],
    },
  };

  const handleRunJoinTest = () => {
    const src = nodes[simSource];
    const conn = src?.connections.find((c) => c.targetId === simTarget);
    if (!conn) {
      if (simSource === simTarget) {
        setSimResult({
          allowed: true,
          reason: 'Direct access evaluation on same dataset under active grant limits.',
          rule: 'RULE_SELF_ACCESS',
        });
      } else {
        setSimResult({
          allowed: false,
          reason: 'No governed path exists between selected resources. Policy denies arbitrary unmapped correlations.',
          rule: 'RULE_NO_DIRECT_PATH',
        });
      }
      return;
    }

    setSimResult({
      allowed: !conn.blocked,
      reason: conn.rule,
      rule: conn.blocked ? 'RULE_SOD_CORRELATION_BLOCK' : 'RULE_PERMITTED_INDIRECT_LINK',
    });
  };

  const activeNodeData = nodes[selectedNode] || nodes.emp_records;

  return (
    <div className="relationship-view-page" id="relationship-view-page">
      {/* Page Title & Intro */}
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">Relationship View & Safeguards</h1>
          <p className="page-subtitle">
            Real-time multi-resource relationship protection preventing indirect inference and Separation-of-Duties (SoD) collisions.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/simulator')}
            id="btn-goto-simulator"
          >
            <Terminal size={15} />
            <span>Open in PEP Simulator</span>
          </button>
        </div>
      </div>

      {/* Main Graph Canvas and Inspection Panel */}
      <div className="relationship-layout-grid">
        {/* Visual Map Canvas */}
        <div className="graph-canvas-card">
          <div className="graph-canvas-header">
            <div className="canvas-header-title">
              <Share2 size={16} color="var(--accent-crimson)" />
              <span className="font-semibold text-sm">Enterprise Relationship Map</span>
            </div>
            {/* Filter buttons */}
            <div className="graph-filter-pills">
              {['ALL', 'FK', 'INDIRECT', 'DEPENDENCY'].map((f) => (
                <button
                  key={f}
                  className={`btn-filter-pill ${filterConnection === f ? 'active' : ''}`}
                  onClick={() => setFilterConnection(f)}
                >
                  {f === 'FK' ? 'Foreign Keys' : f === 'INDIRECT' ? 'Indirect' : f === 'DEPENDENCY' ? 'Dependencies' : 'All Links'}
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-interactive-area">
            {/* Dotted Canvas Background */}
            <svg className="full-graph-svg" viewBox="0 0 620 480">
              <defs>
                <pattern id="full-dot-matrix" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.1" fill="rgba(180, 140, 140, 0.22)" />
                </pattern>
              </defs>
              <rect width="620" height="480" fill="url(#full-dot-matrix)" />

              {/* Render paths */}
              {/* Employee -> Salary (FK - Blocked / Red) */}
              {(filterConnection === 'ALL' || filterConnection === 'FK') && (
                <path
                  d="M 280 190 Q 360 120 450 80"
                  stroke="#e11d48"
                  strokeWidth="2.2"
                  strokeDasharray="5,4"
                  className="svg-link-blocked"
                />
              )}
              {/* Employee -> Performance Reviews (Indirect - Blocked / Rose) */}
              {(filterConnection === 'ALL' || filterConnection === 'INDIRECT') && (
                <path
                  d="M 280 190 Q 400 190 520 200"
                  stroke="#be123c"
                  strokeWidth="1.75"
                  strokeDasharray="4,4"
                />
              )}
              {/* Employee -> Client Data (Indirect - Allowed / Grey) */}
              {(filterConnection === 'ALL' || filterConnection === 'INDIRECT') && (
                <path
                  d="M 280 190 Q 190 240 130 310"
                  stroke="#6b7280"
                  strokeWidth="1.75"
                  strokeDasharray="4,4"
                />
              )}
              {/* Employee -> Projects (Dependency - Allowed / Dark) */}
              {(filterConnection === 'ALL' || filterConnection === 'DEPENDENCY') && (
                <path
                  d="M 280 190 Q 350 240 430 310"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="5,4"
                />
              )}
              {/* Projects -> Marketing LLM */}
              {(filterConnection === 'ALL' || filterConnection === 'DEPENDENCY') && (
                <path
                  d="M 430 310 Q 470 340 520 370"
                  stroke="#334155"
                  strokeWidth="1.75"
                  strokeDasharray="4,4"
                />
              )}
              {/* Client Data -> Customer Insights */}
              {(filterConnection === 'ALL' || filterConnection === 'DEPENDENCY') && (
                <path
                  d="M 130 310 Q 100 350 80 400"
                  stroke="#6b7280"
                  strokeWidth="1.75"
                  strokeDasharray="4,4"
                />
              )}
            </svg>

            {/* Render Nodes as Interactive Buttons */}
            {Object.values(nodes).map((node) => {
              const isSelected = selectedNode === node.id;
              const isGranted = node.access === 'GRANTED';
              const isRestricted = node.access === 'RESTRICTED';

              return (
                <div
                  key={node.id}
                  className={`graph-node-anchor ${isSelected ? 'node-focused' : ''}`}
                  style={{ left: `${(node.x / 620) * 100}%`, top: `${(node.y / 480) * 100}%` }}
                  onClick={() => setSelectedNode(node.id)}
                  id={`node-btn-${node.id}`}
                >
                  <div className={`node-glow-ring ${isGranted ? 'ring-green' : 'ring-red'}`} />
                  <div className={`node-core ${isGranted ? 'core-green' : 'core-red'}`}>
                    {node.type === 'DATASET' ? <Database size={15} color="#fff" /> : <Cpu size={15} color="#fff" />}
                  </div>
                  <div className="node-label-group">
                    <span className="node-name">{node.name}</span>
                    <span className={`node-pill ${isGranted ? 'pill-green' : 'pill-red'}`}>
                      {node.access === 'GRANTED' ? 'Access granted' : node.access === 'RESTRICTED' ? 'Restricted' : 'Not authorised'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graph Legend */}
          <div className="graph-bottom-legend">
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
              <span className="legend-label">Foreign key (Join)</span>
            </div>
            <div className="legend-row">
              <span className="legend-line line-model" />
              <span className="legend-label">Model dependency</span>
            </div>
          </div>
        </div>

        {/* Right Column: Node Inspector & Real-time Join Safeguard Simulator */}
        <div className="relationship-side-column">
          {/* Node Inspector Card */}
          <div className="inspector-panel-card">
            <div className="inspector-card-header">
              <span className="badge-tier-critical font-mono" style={{ fontSize: '0.75rem' }}>
                {activeNodeData.tier}
              </span>
              <span className={`node-pill ${activeNodeData.access === 'GRANTED' ? 'pill-green' : 'pill-red'}`}>
                {activeNodeData.access}
              </span>
            </div>

            <h3 className="inspector-card-title">{activeNodeData.name}</h3>
            <p className="inspector-card-id font-mono">Resource ID: {activeNodeData.id}</p>

            <div className="inspector-connections-section">
              <h4 className="connections-heading">Governed Relationship Links:</h4>
              {activeNodeData.connections.length === 0 ? (
                <p className="no-conn-text">Leaf resource. No outbound governed foreign keys.</p>
              ) : (
                <div className="connections-list">
                  {activeNodeData.connections.map((conn, idx) => (
                    <div key={idx} className={`connection-item ${conn.blocked ? 'conn-blocked' : 'conn-allowed'}`}>
                      <div className="conn-header">
                        <span className="conn-type font-mono">{conn.type} → {nodes[conn.targetId]?.name || conn.targetId}</span>
                        {conn.blocked ? (
                          <span className="conn-status-badge badge-blocked">
                            <Lock size={12} /> Blocked by SoD
                          </span>
                        ) : (
                          <span className="conn-status-badge badge-allowed">
                            <CheckCircle2 size={12} /> Permitted
                          </span>
                        )}
                      </div>
                      <p className="conn-rule-desc">{conn.rule}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Join Safeguard Simulator Card */}
          <div className="join-simulator-card">
            <h3 className="sim-card-title">Multi-Resource Join Tester</h3>
            <p className="sim-card-subtitle">
              Verify if combining two governed datasets triggers an indirect access block or SoD violation.
            </p>

            <div className="sim-controls">
              <div className="form-group">
                <label className="form-label">Source Resource</label>
                <select
                  className="form-select"
                  value={simSource}
                  onChange={(e) => setSimSource(e.target.value)}
                >
                  {Object.values(nodes).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.tier})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Join Resource</label>
                <select
                  className="form-select"
                  value={simTarget}
                  onChange={(e) => setSimTarget(e.target.value)}
                >
                  {Object.values(nodes).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.tier})
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleRunJoinTest}
                id="btn-test-join"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Evaluate Join Safeguard</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {simResult && (
              <div className={`sim-result-box ${simResult.allowed ? 'result-allowed' : 'result-denied'}`}>
                <div className="result-header">
                  {simResult.allowed ? (
                    <div className="result-status status-allowed">
                      <ShieldCheck size={16} />
                      <span>Join Allowed Under Scope</span>
                    </div>
                  ) : (
                    <div className="result-status status-denied">
                      <ShieldAlert size={16} />
                      <span>Join Prohibited by Safeguard</span>
                    </div>
                  )}
                  <span className="font-mono text-xs">{simResult.rule}</span>
                </div>
                <p className="result-reason">{simResult.reason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
