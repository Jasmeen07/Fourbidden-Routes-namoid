import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  return (
    <div className="safety-banner" role="alert" id="safety-banner">
      <ShieldAlert className="safety-banner-icon" size={18} />
      <span>
        <strong>Governance Notice:</strong> Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain.
      </span>
    </div>
  );
};
