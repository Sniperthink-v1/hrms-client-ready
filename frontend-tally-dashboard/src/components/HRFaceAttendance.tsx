import React, { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { logger } from '../utils/logger';

const HRFaceAttendance: React.FC = () => {
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{
    id: number;
    employee_id: string | null;
    employee_name: string | null;
    event_type?: 'registration' | 'verification';
    mode?: 'clock_in' | 'clock_out' | null;
    recognized: boolean;
    confidence?: number;
    message?: string;
    source?: string;
    event_time: string;
  }>>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState<string>('');

  const loadLogs = async (dateStr?: string) => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const d = dateStr ?? date;
      const endpoint = d
        ? `/api/face-attendance/logs/?date=${encodeURIComponent(d)}&limit=100&offset=0`
        : '/api/face-attendance/logs/?limit=100&offset=0';
      const res = await apiGet(endpoint);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch face logs');
      }
      const data = await res.json();
      setLogs(Array.isArray(data?.results) ? data.results : []);
    } catch (err: any) {
      logger.error('Error fetching face attendance logs:', err);
      setLogsError(err.message || 'Failed to load face attendance logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Face Attendance</h1>
      <p className="text-sm text-gray-600 mb-6">
        Centralized log of face-based clock in/out events for this tenant. Data comes from the same backend
        used by the mobile app, so you can audit face usage from the web dashboard.
      </p>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end mb-4">
        <div className="flex-1">
          <label className="block text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name / ID / message / mode / registration"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={() => loadLogs(date)}
          className="w-full md:w-auto bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={logsLoading}
        >
          {logsLoading ? 'Loading…' : 'Refresh Logs'}
        </button>
      </div>

      {logsError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {logsError}
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Time</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Employee</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Mode</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Confidence</th>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {logsLoading && (
              <tr>
                <td className="px-4 py-3" colSpan={6}>
                  Loading logs…
                </td>
              </tr>
            )}
            {!logsLoading && logs.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={6}>
                  No logs found for this date.
                </td>
              </tr>
            )}
            {!logsLoading &&
              logs
                .filter((log) => {
                  const q = query.trim().toLowerCase();
                  if (!q) return true;
                  const emp = (log.employee_name || log.employee_id || '').toLowerCase();
                  const msg = (log.message || '').toLowerCase();
                  const mode = (log.mode || '').toLowerCase();
                  const type = (log.event_type || '').toLowerCase();
                  return (
                    emp.includes(q) ||
                    msg.includes(q) ||
                    mode.includes(q) ||
                    type.includes(q)
                  );
                })
                .map((log) => {
                const time = new Date(log.event_time).toLocaleTimeString();
                const emp = log.employee_name || log.employee_id || 'Unknown';
                const label =
                  log.event_type === 'registration'
                    ? 'Registration'
                    : log.mode === 'clock_in'
                      ? 'Clock In'
                      : log.mode === 'clock_out'
                        ? 'Clock Out'
                        : 'Verification';
                return (
                  <tr key={log.id} className="border-t">
                    <td className="px-4 py-3">{time}</td>
                    <td className="px-4 py-3">{emp}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          log.event_type === 'registration'
                            ? 'bg-amber-50 text-amber-700'
                            : log.recognized
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          log.recognized ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {log.recognized ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {typeof log.confidence === 'number' ? log.confidence.toFixed(3) : '—'}
                    </td>
                    <td className="px-4 py-3">{log.message || '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HRFaceAttendance;
