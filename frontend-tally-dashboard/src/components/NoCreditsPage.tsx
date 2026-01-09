import React, { useState } from 'react';
import { AlertCircle, CreditCard, Mail, Phone, Settings, MessageSquare, Users, Calendar, DollarSign, Upload, BarChart3, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';

const NoCreditsPage: React.FC = () => {
  const navigate = useNavigate();
  const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
  const companyName = tenant?.name || 'your company';
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  const handleRefreshCredits = async () => {
    setRefreshingCredits(true);
    try {
      const response = await apiGet('/api/tenant/credits/');
      const data = await response.json();

      if (data && typeof data.credits === 'number') {
        // Update localStorage with fresh credits
        const updatedTenant = { ...tenant, credits: data.credits };
        localStorage.setItem('tenant', JSON.stringify(updatedTenant));

        // Force page reload to reflect changes
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    } finally {
      setRefreshingCredits(false);
    }
  };

  const availableFeatures = [
    { name: 'Settings', icon: Settings },
    { name: 'Support', icon: MessageSquare },
  ];

  const blockedFeatures = [
    { name: 'Employee Management', icon: Users },
    { name: 'Attendance Tracking', icon: Calendar },
    { name: 'Payroll Processing', icon: DollarSign },
    { name: 'Salary Management', icon: DollarSign },
    { name: 'Leave Management', icon: Calendar },
    { name: 'Reports & Analytics', icon: BarChart3 },
    { name: 'Data Upload', icon: Upload },
  ];

  return (
    <div className="w-full max-w-5xl">
      {/* Compact Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
          <CreditCard className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Account Credits Depleted
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {companyName} • No credits remaining
          </p>
        </div>
      </div>

      {/* Compact Alert */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-3 border-amber-500 rounded p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Contact your administrator to add credits to continue using HR management features.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Available Features - Compact */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Available
            </h2>
          </div>
          <div className="space-y-1.5">
            {availableFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.name}
                  className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded border border-green-200 dark:border-green-800"
                >
                  <Icon className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {feature.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blocked Features - Compact */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Unavailable
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {blockedFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.name}
                  className="flex items-center gap-2 p-1.5 bg-red-50 dark:bg-red-900/10 rounded border border-red-200 dark:border-red-800"
                >
                  <Icon className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {feature.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compact Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button
          onClick={handleRefreshCredits}
          disabled={refreshingCredits}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshingCredits ? 'animate-spin' : ''}`} />
          {refreshingCredits ? 'Refreshing...' : 'Refresh Credits'}
        </button>
        <button
          onClick={() => navigate('/hr-management/settings')}
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={() => navigate('/hr-management/support')}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Contact Support
        </button>
      </div>

      {/* Compact Contact Info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Need help?
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a
            href="mailto:support@sniperthink.com"
            className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 hover:underline"
          >
            <Mail className="w-3 h-3" />
            <span>support@sniperthink.com</span>
          </a>
          <span className="text-gray-400">•</span>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Phone className="w-3 h-3" />
            <span>Contact Administrator</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoCreditsPage;
