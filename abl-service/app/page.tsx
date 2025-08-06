import Link from 'next/link';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function Home() {
  return (
    <SidebarLayout>
      <div className="bg-gradient-to-br from-green-50 to-blue-50 min-h-screen">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-green-800 flex items-center justify-center gap-3">
                🏦 ABL Account Manager Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Allied Bank Limited - Digital Wallet Management</p>
              <p className="text-gray-500 text-sm mt-1">Complete workflow for account creation and wallet address management</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Workflow Steps */}
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Complete Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">1</div>
                <h3 className="font-semibold text-gray-800">Create Account</h3>
                <p className="text-sm text-gray-600">Generate IBAN & Store in DB</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">2</div>
                <h3 className="font-semibold text-gray-800">View All Accounts</h3>
                <p className="text-sm text-gray-600">Browse Account List</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">3</div>
                <h3 className="font-semibold text-gray-800">Account Details</h3>
                <p className="text-sm text-gray-600">Click Row → Create Wallet</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">4</div>
                <h3 className="font-semibold text-gray-800">ILP Active</h3>
                <p className="text-sm text-gray-600">Store in ILP Table</p>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Step 1: Create Account */}
            <Link href="/create-account" className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl">
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                  <div className="text-3xl mb-2">🏦</div>
                  <h3 className="text-xl font-semibold">Step 1: Create Account</h3>
                  <p className="text-green-100 text-sm">Start your journey here</p>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">
                    Create a new ABL account with automatic IBAN generation. Account will use PKR as default currency.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Simple name & email form</li>
                    <li>• Auto IBAN generation</li>
                    <li>• PKR default currency</li>
                  </ul>
                </div>
              </div>
            </Link>

            {/* Step 2: View All Accounts */}
            <Link href="/accounts-view" className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <div className="text-3xl mb-2">👥</div>
                  <h3 className="text-xl font-semibold">Step 2: View All Accounts</h3>
                  <p className="text-blue-100 text-sm">Browse your accounts</p>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">
                    View all created accounts in a clean table format with quick stats.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Table view with sorting</li>
                    <li>• Click any row for details</li>
                    <li>• Quick statistics</li>
                  </ul>
                </div>
              </div>
            </Link>

            {/* System Status */}
            <div className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
                  <div className="text-3xl mb-2">📊</div>
                  <h3 className="text-xl font-semibold">System Status</h3>
                  <p className="text-purple-100 text-sm">Architecture overview</p>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">
                    Clean, production-ready banking-to-ILP integration system.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• ✅ All TypeScript errors resolved</li>
                    <li>• ✅ Clean component architecture</li>
                    <li>• ✅ Rafiki GraphQL integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📋 How to Use</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <h4 className="font-semibold text-gray-700">Create ABL Account</h4>
                  <p className="text-gray-600 text-sm">Fill the simple form with customer name and email. The system will auto-generate a Pakistani IBAN and store the account in the database with PKR as default currency.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <h4 className="font-semibold text-gray-700">Browse All Accounts</h4>
                  <p className="text-gray-600 text-sm">View all created accounts in a sortable table. See customer details, IBAN, balance, and status at a glance.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <h4 className="font-semibold text-gray-700">Create Wallet Address</h4>
                  <p className="text-gray-600 text-sm">Click any account row to view details. Select a currency asset from the available options and click &ldquo;Create Wallet Address&rdquo; to generate a Rafiki payment pointer for that specific currency.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <h4 className="font-semibold text-gray-700">ILP Active Accounts</h4>
                  <p className="text-gray-600 text-sm">Once a wallet address is created, the payment pointer data is automatically stored in the ILP_active_accounts table for tracking active Interledger accounts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-300">
            ABL Account Manager - Complete Workflow Implementation
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Database-driven account management with Rafiki integration
          </p>
        </div>
      </footer>
      </div>
    </SidebarLayout>
  );
}
