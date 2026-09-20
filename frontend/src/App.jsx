import React, { useState } from 'react';
import { OrderProvider, useOrder } from './context/OrderContext';
import Navbar from './components/Navbar';
import TopHeader from './components/TopHeader';
import CustomerTopHeader from './components/CustomerTopHeader';
import CustomerMenu from './pages/CustomerMenu';
import BarReception from './pages/BarReception';
import StaffPanel from './pages/StaffPanel';
import AdminPanel from './pages/AdminPanel';
import MemberCardPanel from './pages/MemberCardPanel';
import MemberEntryScannerPanel from './pages/MemberEntryScannerPanel';
import CategoryReportsPanel from './pages/CategoryReportsPanel';
import PubLayoutPanel from './pages/PubLayoutPanel';
import StaffAccountsPanel from './pages/StaffAccountsPanel';
import LoginPage from './pages/LoginPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.clear();
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center font-sans">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <span className="text-2xl">🚨</span>
              <h2 className="text-lg font-black text-rose-400">Application Error Detected</h2>
            </div>
            
            <p className="text-xs text-slate-300">
              An unexpected display error occurred in the browser. Click below to clear local session cache and restore the application.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-48">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2 text-slate-500 text-[10px]">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl text-xs shadow-lg transition"
            >
              🔄 Reset App Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainContent() {
  const { activeTab } = useOrder();

  return (
    <main className="w-full">
      {activeTab === 'customer' && <CustomerMenu />}
      {activeTab === 'entry_scanner' && <MemberEntryScannerPanel />}
      {(activeTab === 'bar' || activeTab === 'kitchen') && <BarReception />}
      {activeTab === 'staff' && <StaffPanel />}
      {activeTab === 'reports' && <CategoryReportsPanel />}
      {activeTab === 'tables' && <PubLayoutPanel />}
      {activeTab === 'staff_accounts' && <StaffAccountsPanel />}
      {activeTab === 'members' && <MemberCardPanel />}
      {activeTab === 'admin' && <AdminPanel />}
    </main>
  );
}

function AppContent() {
  const { currentUser, isCustomerQrMode, setActiveTab } = useOrder();
  const [guestBypass, setGuestBypass] = useState(false);

  // Pure Customer QR Scan Mode (e.g. ?table=DN-01) - Dedicated mobile view
  if (isCustomerQrMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden pub-ambient-bg">
        <div className="pub-spotlight spotlight-left pointer-events-none" />
        <div className="pub-spotlight spotlight-right pointer-events-none" />
        <CustomerTopHeader />
        <main className="flex-1 w-full max-w-7xl mx-auto z-10">
          <CustomerMenu />
        </main>
      </div>
    );
  }

  // Render Login Page FIRST if not logged in and not customer QR scan
  if (!currentUser && !guestBypass) {
    return (
      <LoginPage
        onBypassGuest={() => {
          setGuestBypass(true);
          setActiveTab('customer');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative overflow-x-hidden pub-ambient-bg">
      {/* Ambient Pub Spotlight Glows */}
      <div className="pub-spotlight spotlight-left pointer-events-none" />
      <div className="pub-spotlight spotlight-right pointer-events-none" />

      {/* Executive Left Vertical Navbar */}
      <Navbar />

      {/* Main Content Area - Shifted right of left vertical navbar */}
      <div className="flex-1 md:ml-64 lg:ml-72 min-w-0 z-10 flex flex-col min-h-screen">
        <TopHeader />
        <MainContent />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <OrderProvider>
        <AppContent />
      </OrderProvider>
    </ErrorBoundary>
  );
}


