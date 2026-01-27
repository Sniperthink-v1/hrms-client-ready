import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, User, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { apiCall } from '../services/api';
import DatePicker from './DatePicker';
import { logger } from '../utils/logger';
import { SkeletonBase } from './SkeletonComponents';

interface CheckLogEntry {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  working_hours: number | null;
  attendance_status: string;
}

const HRDailyCheckLog: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checkLogData, setCheckLogData] = useState<CheckLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [checkLogError, setCheckLogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch daily check log data
  const fetchCheckLogData = useCallback(async (date: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    setCheckLogError(null);

    try {
      logger.info(`📅 Fetching daily check log for date: ${date}`);

      const response = await apiCall(`/api/daily-attendance/all_records/?date=${date}&limit=1000`);

      if (!response.ok) {
        throw new Error(`Failed to fetch check log data: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`✅ Fetched ${data.results?.length || 0} check log entries`);

      // Filter and format the data
      const formattedData: CheckLogEntry[] = (data.results || []).map((item: any) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_name: item.employee_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown',
        department: item.department || 'General',
        date: item.date,
        check_in: item.check_in,
        check_out: item.check_out,
        working_hours: item.working_hours,
        attendance_status: item.attendance_status,
      }));

      // Sort by check-in time (earliest first)
      formattedData.sort((a, b) => {
        if (!a.check_in && !b.check_in) return 0;
        if (!a.check_in) return 1;
        if (!b.check_in) return -1;
        return a.check_in.localeCompare(b.check_in);
      });

      setCheckLogData(formattedData);
    } catch (err: any) {
      logger.error('❌ Error fetching check log data:', err);
      setCheckLogError(err.message || 'Failed to load check log data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle date change
  const handleDateChange = useCallback(
    (newDate: string) => {
      setSelectedDate(newDate);
      fetchCheckLogData(newDate);
    },
    [fetchCheckLogData]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCheckLogData(selectedDate, false);
  }, [selectedDate, fetchCheckLogData]);

  // Initial load
  useEffect(() => {
    fetchCheckLogData(selectedDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper function to format time
  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '--:--';
    return timeString;
  };

  // Helper function to get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'absent':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'off':
        return { icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50' };
      default:
        return { icon: AlertCircle, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  // Helper function to calculate working hours display
  const formatWorkingHours = (hours: number | null): string => {
    if (hours === null || hours === undefined) return '--';
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Check Log</h1>
            <p className="text-gray-600 mt-1">View employee check-in and check-out times for selected date</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Select Date:</span>
          </div>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            maxDate={new Date()}
            placeholder="Select date"
            className="min-w-[180px]"
          />
        </div>
      </div>

      {/* Stats Summary */}
      {!loading && !checkLogError && checkLogData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-xl font-bold text-gray-900">{checkLogData.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Checked In</p>
                <p className="text-xl font-bold text-gray-900">
                  {checkLogData.filter((item) => item.check_in).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Checked Out</p>
                <p className="text-xl font-bold text-gray-900">
                  {checkLogData.filter((item) => item.check_out).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">No Check-in</p>
                <p className="text-xl font-bold text-gray-900">
                  {checkLogData.filter((item) => !item.check_in).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check Log Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 border-b border-gray-100">
                  <SkeletonBase className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBase className="h-4 w-48" />
                    <SkeletonBase className="h-3 w-32" />
                  </div>
                  <div className="flex space-x-6">
                    <SkeletonBase className="h-4 w-16" />
                    <SkeletonBase className="h-4 w-16" />
                    <SkeletonBase className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : checkLogError ? (
          <div className="p-6 text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Error loading check log data</p>
            <p className="text-gray-600 text-sm mt-2">{checkLogError}</p>
          </div>
        ) : checkLogData.length === 0 ? (
          <div className="p-6 text-center">
            <Calendar size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No check log data found</p>
            <p className="text-gray-500 text-sm mt-2">
              No attendance records found for {new Date(selectedDate).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-600 px-6 py-4">Employee</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-6 py-4">Department</th>
                  <th className="text-center text-sm font-medium text-gray-600 px-6 py-4">Status</th>
                  <th className="text-center text-sm font-medium text-gray-600 px-6 py-4">Check In</th>
                  <th className="text-center text-sm font-medium text-gray-600 px-6 py-4">Check Out</th>
                  <th className="text-center text-sm font-medium text-gray-600 px-6 py-4">Working Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checkLogData.map((entry) => {
                  const statusInfo = getStatusInfo(entry.attendance_status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{entry.employee_name}</div>
                          <div className="text-sm text-gray-500">ID: {entry.employee_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{entry.department}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          <StatusIcon size={12} />
                          {entry.attendance_status || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock size={14} className={entry.check_in ? 'text-green-600' : 'text-gray-400'} />
                          <span className={`text-sm font-medium ${entry.check_in ? 'text-gray-900' : 'text-gray-400'}`}>
                            {formatTime(entry.check_in)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock size={14} className={entry.check_out ? 'text-orange-600' : 'text-gray-400'} />
                          <span className={`text-sm font-medium ${entry.check_out ? 'text-gray-900' : 'text-gray-400'}`}>
                            {formatTime(entry.check_out)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-medium ${entry.working_hours ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatWorkingHours(entry.working_hours)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRDailyCheckLog;
