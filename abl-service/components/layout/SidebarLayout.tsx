'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: '🏠',
    description: 'Overview and workflow guide'
  },
  {
    name: 'Customer Management',
    href: '/customers',
    icon: '👥',
    description: 'Browse Customers'
  },
  {
    name: 'Account Management',
    href: '/accounts-list',
    icon: '🏦',
    description: 'Browse accounts'
  },
  {
    name: 'Wallet Address',
    href: '/payment-pointers',
    icon: '💳',
    description: 'ILP Address management'
  },
  
];

const stats = [
  { name: 'Backend', status: 'Connected', color: 'text-green-600' },
  { name: 'Database', status: 'Active', color: 'text-blue-600' },
  { name: 'Rafiki', status: 'Ready', color: 'text-purple-600' }
];

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl border-r border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-2xl">🏦</span>
              <span className="ml-2 text-lg font-semibold text-gray-900">ABL Core Banking System</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarContent pathname={pathname} collapsed={false} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200 shadow-sm">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 bg-white">
            {!sidebarCollapsed && (
              <div className="flex items-center">
                <span className="text-2xl">🏦</span>
                <span className="ml-2 text-lg font-semibold text-gray-900">ABL Core Banking System</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex justify-center w-full">
                <span className="text-2xl">🏦</span>
              </div>
            )}
            
            {/* Collapse/Expand Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                sidebarCollapsed ? 'ml-0' : 'ml-2'
              }`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg 
                className={`h-4 w-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          <SidebarContent pathname={pathname} collapsed={sidebarCollapsed} />
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      }`}>
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden rounded-md hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="h-6 w-px bg-gray-200 lg:hidden" />
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <span className="text-sm font-medium text-gray-900">ABL Account Manager</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-green-50 text-green-700 border-r-2 border-green-500'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.name : ''}
            >
              <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>{item.icon}</span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className={`text-xs truncate ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                    {item.description}
                  </div>
                </div>
              )}
              {!collapsed && isActive && (
                <div className="ml-2 flex-shrink-0">
                  <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </Link>
          );
        })}
      </nav>


      {/* Collapsed Workflow Indicators */}
      {collapsed && (
        <div className="px-2 py-4 border-t border-gray-200">
          <div className="space-y-2 flex flex-col items-center">
            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Create Account">1</div>
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="View All Accounts">2</div>
            <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Create Wallet">3</div>
            <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="ILP Active">4</div>
          </div>
        </div>
      )}

      {/* System Status */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            System Status
          </h3>
          <div className="space-y-2">
            {stats.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate">{stat.name}</span>
                <span className={`font-medium ${stat.color} truncate ml-2`}>{stat.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed Status Indicators */}
      {collapsed && (
        <div className="px-2 py-4 border-t border-gray-200">
          <div className="space-y-2 flex flex-col items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Backend: Connected"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Database: Active"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full" title="Rafiki: Ready"></div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`px-4 py-4 border-t border-gray-200 bg-gray-50 ${collapsed ? 'px-2' : ''}`}>
        <div className="text-center">
          {!collapsed ? (
            <>
              <p className="text-xs text-gray-500">ABL Core Banking System</p>
              <p className="text-xs text-gray-400">v1.0.0</p>
            </>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full" title=" ABL Core Banking System"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
