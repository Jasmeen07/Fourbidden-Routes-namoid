import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SafetyBanner } from './components/SafetyBanner';
import { Navbar } from './components/Navbar';
import { ProblemModal } from './components/ProblemModal';
import { CatalogPage } from './pages/CatalogPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { RequestsListPage } from './pages/RequestsListPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { GrantsPage } from './pages/GrantsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { AuditExplorerPage } from './pages/AuditExplorerPage';
import { PolicyLinterPage } from './pages/PolicyLinterPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container">
          {/* Mandatory Blueprint §12.1 Safety Banner */}
          <SafetyBanner />

          {/* Navigation Bar & Persona Switcher */}
          <Navbar />

          {/* RFC 9457 Global Problem Details Modal */}
          <ProblemModal />

          {/* Main Content Router */}
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/catalog" replace />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/requests" element={<RequestsListPage />} />
              <Route path="/requests/new" element={<NewRequestPage />} />
              <Route path="/reviews" element={<ReviewQueuePage />} />
              <Route path="/grants" element={<GrantsPage />} />
              <Route path="/simulator" element={<SimulatorPage />} />
              <Route path="/audit" element={<AuditExplorerPage />} />
              <Route path="/policy" element={<PolicyLinterPage />} />
              <Route path="*" element={<Navigate to="/catalog" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
