export type ResourceTier = 'TIER_1_CRITICAL' | 'TIER_2_SENSITIVE' | 'TIER_3_STANDARD' | 'RESTRICTED_SYNTHETIC' | 'INTERNAL_SYNTHETIC' | 'PUBLIC_SYNTHETIC';
export type ResourceType = 'MODEL' | 'DATASET' | 'TOOL';

export interface ResourceLimits {
  max_records?: number;
  allowed_formats?: string[];
  ip_allowlist?: string[];
  max_rps?: number;
  max_cost_usd?: number;
  custom?: Record<string, any>;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  tier: ResourceTier;
  description: string;
  allowed_actions: string[];
  max_duration_hours: number;
  required_controls: string[];
  risk_score?: number;
  department?: string;
  sensitivity?: string;
  is_crucial?: boolean;
  is_active: boolean;
}

export type RequestStatus = 'IN_REVIEW' | 'BLOCKED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type SlotStatus = 'PENDING' | 'APPROVED' | 'NARROWED' | 'REJECTED' | 'CANCELLED';

export interface ReviewSlot {
  id: string;
  slot_index?: number;
  slot_role: string;
  required_role?: string;
  assigned_sub?: string;
  assigned_to_user_id?: string;
  assigned_to_user_name?: string;
  status: SlotStatus;
  decision?: string;
  rationale?: string;
  decision_rationale?: string;
  approved_limits?: {
    actions?: string[];
    duration_minutes?: number;
    [key: string]: any;
  };
  narrowed_limits?: ResourceLimits;
  decided_by_sub?: string;
  decided_at?: string;
}

export interface AccessRequest {
  id: string;
  requester_sub: string;
  requester_id?: string;
  requester_name?: string;
  requester_role?: string;
  resource_id: string;
  resource_name?: string;
  resource_tier?: ResourceTier;
  purpose_code: string;
  purpose_text?: string;
  purpose?: string;
  justification?: string;
  actions: string[];
  duration_minutes: number;
  duration_hours?: number;
  risk_controls: string[];
  required_controls?: string[];
  requested_limits?: ResourceLimits;
  status: RequestStatus;
  created_at: string;
  closed_at?: string;
  slots_count?: number;
  pending_slots?: string[];
  slots: ReviewSlot[];
  is_crucial?: boolean;
}

export type GrantStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface Grant {
  id: string;
  request_id: string;
  subject_id?: string;
  subject_name?: string;
  requester_sub: string;
  resource_id: string;
  resource_name?: string;
  resource_tier?: ResourceTier;
  purpose_code?: string;
  actions: string[];
  granted_limits?: ResourceLimits;
  duration_seconds?: number;
  status: GrantStatus;
  effective_status?: GrantStatus;
  activated_at?: string;
  created_at?: string;
  expires_at: string;
  revoked_at?: string;
  revocation_reason?: string;
  revoke_reason_code?: string;
  revoke_emergency?: boolean;
  is_emergency?: boolean;
  last_used_at?: string;
  invocation_count?: number;
  utilization_status?: 'ACTIVE_UTILIZING' | 'REVIEW_SUGGESTED' | 'NEVER_USED';
}

export interface RoleGuidance {
  title: string;
  focus_areas: string[];
  key_questions: string[];
}

export interface DecisionLineageItem {
  slot_role: string;
  decided_by_sub: string;
  status: string;
  decision: string;
  approved_limits?: ResourceLimits;
  rationale?: string;
  decided_at?: string;
}


export interface ApprovalAssistanceData {
  request_id: string;
  resource_name: string;
  resource_tier: string;
  resource_sensitivity?: string;
  is_crucial?: boolean;
  is_cross_dept?: boolean;
  requester?: {
    sub: string;
    department: string;
    is_agent: boolean;
    owner_sub?: string | null;
  };
  guidance: Record<string, RoleGuidance>;
  lineage: DecisionLineageItem[];
}

export interface Principal {
  id: string;
  name: string;
  role: string;
  department: string;
  manager_id?: string | null;
  email?: string | null;
  is_agent: boolean;
  owner_id?: string | null;
  delegated_permissions?: string[];
  owned_agents?: Array<{
    id: string;
    name: string;
    department: string;
    delegated_permissions: string[];
    owner_id: string;
  }>;
}

export interface ApprovalPreviewStep {
  slot_role: string;
  assigned_sub: string;
  level: number;
  title: string;
  is_crucial_escalation: boolean;
}

export interface ApprovalPreviewResponse {
  requester_id: string;
  requester_name: string;
  resource_id: string;
  resource_name: string;
  is_crucial: boolean;
  is_cross_dept: boolean;
  steps: ApprovalPreviewStep[];
}

export interface ProvenanceEventNode {
  id: string;
  principal_id: string;
  event_type: 'message' | 'tool_call' | 'tool_result' | 'external_send';
  action?: string | null;
  resource_id?: string | null;
  target_destination?: string | null;
  label: 'clean' | 'untrusted_input' | 'sensitive_input';
  payload?: any;
  timestamp: string;
  propagated_labels?: string[];
  is_tainted?: boolean;
  has_secret?: boolean;
  untrusted_influences?: string[];
  sensitive_influences?: string[];
  enforcement_status?: 'ALLOWED' | 'BLOCKED' | 'MONITORED';
  enforcement_reason?: string | null;
  enforcement_policy?: string | null;
}

export interface ProvenanceEventEdge {
  id: string;
  source_id: string;
  target_id: string;
}

export interface ProvenanceSecurityAlert {
  id: string;
  event_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SUSPICIOUS_PROMPT' | 'SENSITIVE_DATA_ACCESS' | 'DATA_LEAKAGE_ATTEMPT' | 'TAINT_SECRET_CONVERGENCE';
  title: string;
  description: string;
  timestamp: string;
  agent_id: string;
  action?: string | null;
  status: string;
  resource_id?: string | null;
  target_destination?: string | null;
}

export interface ProvenanceAuditItem {
  event_id: string;
  timestamp: string;
  agent_id: string;
  event_type: string;
  action: string;
  target: string;
  is_tainted: boolean;
  has_secret: boolean;
  enforcement_decision: 'ALLOWED' | 'BLOCKED' | 'MONITORED';
  enforcement_reason?: string | null;
  policy?: string | null;
  payload?: any;
}

export interface ProvenanceKpis {
  monitored_events: number;
  risky_events: number;
  blocked_transmissions: number;
  active_ai_agents: number;
  clean_events: number;
  active_agents_list: string[];
}

export interface AuditEvent {
  seq: number;
  event_id: string;
  prev_hash: string;
  event_type: string;
  actor_id: string;
  resource_id?: string;
  payload: Record<string, any>;
  recorded_at: string;
  hash: string;
}


export interface TraceStep {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  detail: string;
  timestamp: string;
}

export interface PdpDecisionTrace {
  decision: 'ALLOW' | 'DENY';
  grant_id?: string;
  subject_id: string;
  resource_id: string;
  action: string;
  purpose: string;
  steps: TraceStep[];
  timestamp: string;
  denial_reason?: string;
  mock_response?: {
    watermark: string;
    resource_id: string;
    action: string;
    payload_preview: any;
  };
}

export interface PolicyFinding {
  level: 'INFO' | 'WARN' | 'ERROR';
  code: string;
  message: string;
  path?: string;
}

export interface PolicyLintReport {
  is_valid: boolean;
  version: string;
  checked_at: string;
  total_findings: number;
  findings: PolicyFinding[];
}

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: string;
  badge: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  user_sub?: string;
  method: string;
  path: string;
  category: string;
  pattern_matched?: string;
  risk_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action_taken: 'ALLOWED' | 'FLAGGED' | 'RATE_LIMITED' | 'BLOCKED';
  repeat_count: number;
  incident_id?: string;
  payload_snippet?: string;
  status: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'NEW' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
  source_ip: string;
  user_sub?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  notes_count?: number;
  investigation_notes?: {
    note_id: string;
    timestamp: string;
    author: string;
    text: string;
  }[];
  servicenow_sys_id?: string;
  servicenow_number?: string;
  webhook_status?: 'PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'FAILED' | 'MOCKED';
  webhook_payload?: Record<string, any>;
  associated_events?: {
    id: string;
    timestamp: string;
    category: string;
    pattern: string;
    risk_score: number;
    severity: string;
    action: string;
    path: string;
  }[];
}

export interface ServiceNowIncidentSummary {
  id: string;
  title: string;
  servicenow_number?: string;
  servicenow_sys_id?: string;
  status: string;
  severity: string;
  priority: string;
  webhook_status: string;
  created_at: string;
}

export interface ServiceNowStatusResponse {
  enabled: boolean;
  mock_mode: boolean;
  instance_url: string;
  webhook_configured: boolean;
  table: string;
  total_incidents_opened: number;
  total_dispatched: number;
  recent_incidents: ServiceNowIncidentSummary[];
}

export interface IpReputation {
  ip: string;
  status: 'CLEAN' | 'FLAGGED' | 'TEMP_BLOCKED' | 'PERM_BLOCKED' | 'ALLOWLISTED';
  risk_score: number;
  malicious_attempts: number;
  last_seen_at: string;
  blocked_until?: string;
  block_reason?: string;
  manual_override: boolean;
}

export interface ThreatIntelIndicator {
  id: string;
  type: 'IP' | 'DOMAIN' | 'URL' | 'HASH';
  value: string;
  threat_actor?: string;
  campaign?: string;
  confidence: number;
  description: string;
  added_at: string;
}

export interface SecOpsSummary {
  active_incidents: number;
  blocked_ips: number;
  total_security_events: number;
  attacks_detected: number;
  active_threat_intel_count: number;
  recent_incidents: {
    id: string;
    title: string;
    severity: string;
    priority: string;
    status: string;
    source_ip: string;
    created_at: string;
  }[];
}
