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
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-12 text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 2h8a1 1 0 110 2H6a1 1 0 110-2zm0 3h4a1 1 0 110 2H6a1 1 0 110-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              ABL Core Banking System
            </h1>
            <p className="text-xl text-gray-600 mb-2">Allied Bank Limited</p>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Professional banking infrastructure with Rafiki ILP integration for modern financial services
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {isLoading ? '...' : stats.totalAccounts}
              </div>
              <div className="text-gray-600">Total Accounts</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {isLoading ? '...' : `PKR ${stats.totalBalance.toLocaleString()}`}
              </div>
              <div className="text-gray-600">Total Balance</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {isLoading ? '...' : stats.activeWallets}
              </div>
              <div className="text-gray-600">Active Wallets</div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Link href="/create-account">
              <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-8 text-center group cursor-pointer">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Account</h3>
                <p className="text-gray-600">
                  Set up new customer accounts with automatic IBAN generation and PKR currency setup
                </p>
              </div>
            </Link>

            <Link href="/accounts-view">
              <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-8 text-center group cursor-pointer">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">View Accounts</h3>
                <p className="text-gray-600">
                  Browse and manage all customer accounts with detailed information and balance tracking
                </p>
              </div>
            </Link>

            <Link href="/payment-pointers">
              <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-8 text-center group cursor-pointer">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Pointers</h3>
                <p className="text-gray-600">
                  Manage Rafiki wallet addresses and ILP integration for cross-border payments
                </p>
              </div>
            </Link>
          </div>

          {/* Features Overview */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">System Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Secure</h4>
                <p className="text-sm text-gray-600">Bank-grade security</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Fast</h4>
                <p className="text-sm text-gray-600">Real-time processing</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9V3" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Connected</h4>
                <p className="text-sm text-gray-600">ILP integration</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Modern</h4>
                <p className="text-sm text-gray-600">Professional UX</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-800 text-white py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">System Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-sm">Rafiki Connected</span>
              </div>
            </div>
            <p className="text-gray-300 mb-2">
              ABL Core Banking System - Professional Banking Infrastructure
            </p>
            <p className="text-gray-400 text-sm">
              © 2025 Allied Bank Limited. Enterprise Grade Banking Solutions.
            </p>
          </div>
        </footer>
      </div>
    </SidebarLayout>
  );
}
