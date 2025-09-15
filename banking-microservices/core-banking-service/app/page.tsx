'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface DashboardStats {
  totalAccounts: number;
  totalBalance: number;
  activeWallets: number;
  systemStatus: 'online' | 'offline';
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    totalBalance: 0,
    activeWallets: 0,
    systemStatus: 'online'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [accountsRes, walletsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/payment-pointers')
      ]);

      const accountsData = await accountsRes.json();
      const walletsData = await walletsRes.json();

      if (accountsData.success && walletsData.success) {
        const totalBalance = accountsData.data.reduce((sum: number, account: any) => 
          sum + parseFloat(account.balance || 0), 0
        );

        setStats({
          totalAccounts: accountsData.data.length,
          totalBalance: totalBalance,
          activeWallets: walletsData.data.length,
          systemStatus: 'online'
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStats(prev => ({ ...prev, systemStatus: 'offline' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-orange-500 to-blue-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-12 text-center">
            <div className="flex items-center justify-center mb-6">
              {/* ABL Logo */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                                    <img 
                    src="/A.png" 
                    alt="Allied Bank Limited Logo" 
                    className="w-16 h-14 object-contain mr-4"
                  />
                </div>
                <div className="text-left">
                  <h1 className="text-4xl font-bold text-white mb-1">
                    Allied Bank
                  </h1>
                  <p className="text-xl text-orange-200 font-medium">Core Banking System</p>
                </div>
              </div>
            </div>
            <p className="text-white/90 max-w-2xl mx-auto text-lg">
              Professional banking infrastructure with Rafiki ILP integration for modern financial services
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <Link href="/customers">
              <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center group cursor-pointer border-l-4 border-orange-500 hover:border-orange-600">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">👥 Customers</h3>
                <p className="text-gray-600">
                  Manage customer information, create new customers, and view customer details
                </p>
              </div>
            </Link>

            <Link href="/">
              <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center group cursor-pointer border-l-4 border-blue-600 hover:border-blue-700">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">➕ Create Account</h3>
                <p className="text-gray-600">
                  Set up new customer accounts with automatic IBAN generation and PKR currency setup
                </p>
              </div>
            </Link>

            <Link href="/accounts-management">
              <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center group cursor-pointer border-l-4 border-orange-600 hover:border-orange-700">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">📊 Manage Accounts</h3>
                <p className="text-gray-600">
                  Browse and manage all customer accounts with detailed information and balance tracking
                </p>
              </div>
            </Link>

            <Link href="/payment-pointers">
              <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center group cursor-pointer border-l-4 border-blue-700 hover:border-blue-800">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">💳 Payment Pointers</h3>
                <p className="text-gray-600">
                  Manage Rafiki wallet addresses and ILP integration for cross-border payments
                </p>
              </div>
            </Link>
          </div>

          {/* Features Overview */}
          <div className="bg-gradient-to-br from-white to-orange-50 rounded-xl shadow-lg p-8 border-t-4 border-orange-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-700 bg-clip-text text-transparent mb-2">
                System Features
              </h2>
              <p className="text-gray-600">Advanced banking capabilities powered by Allied Bank's infrastructure</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-lg hover:bg-orange-50 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">🔒 Secure</h4>
                <p className="text-sm text-gray-600">Bank-grade security with military-level encryption</p>
              </div>
              
              <div className="text-center p-4 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">⚡ Fast</h4>
                <p className="text-sm text-gray-600">Lightning-fast real-time processing</p>
              </div>
              
              <div className="text-center p-4 rounded-lg hover:bg-orange-50 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9V3" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">🌐 Connected</h4>
                <p className="text-sm text-gray-600">Global ILP network integration</p>
              </div>
              
              <div className="text-center p-4 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">💎 Modern</h4>
                <p className="text-sm text-gray-600">Next-generation banking UX</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gradient-to-r from-orange-600 via-blue-700 to-blue-800 text-white py-12 mt-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* ABL Branding */}
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start mb-4">
                                    <img 
                    src="/A.png" 
                    alt="Allied Bank Limited Logo" 
                    className="w-12 h-10 object-contain mr-3"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white">Allied Bank</h3>
                    <p className="text-orange-200 text-sm">Core Banking System</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm">
                  Leading Pakistan's digital banking transformation with cutting-edge technology and innovative financial solutions.
                </p>
              </div>

              {/* System Status */}
              <div className="text-center">
                <h4 className="text-lg font-semibold text-white mb-4">System Status</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white/90 text-sm">✅ Core Banking Online</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-white/90 text-sm">🌐 Rafiki ILP Connected</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-white/90 text-sm">🔒 Security Active</span>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="text-center md:text-right">
                <h4 className="text-lg font-semibold text-white mb-4">Quick Access</h4>
                <div className="space-y-2">
                  <p className="text-white/80 text-sm">🏦 Enterprise Banking Solutions</p>
                  <p className="text-white/80 text-sm">💳 Digital Payment Infrastructure</p>
                  <p className="text-white/80 text-sm">🌍 Cross-Border Payments</p>
                  <p className="text-white/80 text-sm">📊 Real-Time Analytics</p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/20 pt-6 text-center">
              <p className="text-white/90 mb-2 font-medium">
                ABL Core Banking System - Enterprise Grade Financial Infrastructure
              </p>
              <p className="text-white/70 text-sm">
                © 2025 Allied Bank Limited. Empowering Pakistan's Digital Economy. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </SidebarLayout>
  );
}
