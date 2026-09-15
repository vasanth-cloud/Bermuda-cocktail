import React from 'react';
import { OrderProvider, useOrder } from './context/OrderContext';
import Navbar from './components/Navbar';
import CustomerMenu from './pages/CustomerMenu';
import BarReception from './pages/BarReception';
import KitchenKDS from './pages/KitchenKDS';
import StaffPanel from './pages/StaffPanel';
import AdminPanel from './pages/AdminPanel';

function MainContent() {
  const { activeTab } = useOrder();

  return (
    <main className="w-full">
      {activeTab === 'customer' && <CustomerMenu />}
      {activeTab === 'bar' && <BarReception />}
      {activeTab === 'kitchen' && <KitchenKDS />}
      {activeTab === 'staff' && <StaffPanel />}
      {activeTab === 'admin' && <AdminPanel />}
    </main>
  );
}

export default function App() {
  return (
    <OrderProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative overflow-x-hidden pub-ambient-bg">
        {/* Ambient Pub Spotlight Glows */}
        <div className="pub-spotlight spotlight-left pointer-events-none" />
        <div className="pub-spotlight spotlight-right pointer-events-none" />

        {/* Executive Left Vertical Navbar */}
        <Navbar />

        {/* Main Content Area - Shifted right of left vertical navbar */}
        <div className="flex-1 md:ml-64 lg:ml-72 min-w-0 z-10">
          <MainContent />
        </div>
      </div>
    </OrderProvider>
  );
}
