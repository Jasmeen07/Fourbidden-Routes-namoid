import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SafetyBanner } from './components/SafetyBanner';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ProblemModal } from './components/ProblemModal';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { RequestsListPage } from './pages/RequestsListPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { GrantsPage } from './pages/GrantsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { AuditExplorerPage } from './pages/AuditExplorerPage';
import { PolicyLinterPage } from './pages/PolicyLinterPage';
import { RelationshipViewPage } from './pages/RelationshipViewPage';
import { HierarchyPage } from './pages/HierarchyPage';
import { ProvenancePage } from './pages/ProvenancePage';
import { SignInPage } from './pages/SignInPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { SecOpsPage } from './pages/SecOpsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="grantgate-layout">
          {/* Left Dark Wine Sidebar matching the image */}
          <Sidebar />

          {/* Right Main Column */}
          <div className="grantgate-main-wrapper">
            {/* Mandatory Blueprint §11.3 / §12.1 Safety Banner */}
            <SafetyBanner />

            {/* Top Bar Header with search pill, user profile, notifications & spiderweb */}
            <TopHeader />

            {/* RFC 9457 Global Problem Details Modal */}
            <ProblemModal />

            {/* Main Content Router */}
            <main className="main-viewport-content">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/login" element={<SignInPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/catalog" element={<CatalogPage />} />
                <Route path="/requests" element={<RequestsListPage />} />
                <Route path="/requests/new" element={<NewRequestPage />} />
                <Route path="/reviews" element={<ReviewQueuePage />} />
                <Route path="/hierarchy" element={<HierarchyPage />} />
                <Route path="/provenance" element={<ProvenancePage />} />
                <Route path="/relationships" element={<RelationshipViewPage />} />
                <Route path="/grants" element={<GrantsPage />} />
                <Route path="/simulator" element={<SimulatorPage />} />
                <Route path="/audit" element={<AuditExplorerPage />} />
                <Route path="/policy" element={<PolicyLinterPage />} />
                <Route path="/secops" element={<SecOpsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
