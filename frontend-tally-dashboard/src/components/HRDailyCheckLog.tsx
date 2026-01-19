import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, User, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { apiCall, apiUpload } from '../services/api';
import DatePicker from './DatePicker';
import { logger } from '../utils/logger';
import { SkeletonBase } from './SkeletonComponents';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

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
  const [activeTab, setActiveTab] = useState<'check-log' | 'registration' | 'recognition'>('check-log');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checkLogData, setCheckLogData] = useState<CheckLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [checkLogError, setCheckLogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [registrationPreview, setRegistrationPreview] = useState<string | null>(null);
  const [registrationUploading, setRegistrationUploading] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [recognitionMode, setRecognitionMode] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [recognitionInProgress, setRecognitionInProgress] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
  const [detectorLoading, setDetectorLoading] = useState(false);
  const [lastRecognitionStatus, setLastRecognitionStatus] = useState<'success' | 'failed' | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [recognitionLog, setRecognitionLog] = useState<
    Array<{ id: string; timestamp: string; status: 'success' | 'failed'; message: string }>
  >([]);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const registrationVideoRef = useRef<HTMLVideoElement | null>(null);
  const recognitionVideoRef = useRef<HTMLVideoElement | null>(null);
  const registrationStreamRef = useRef<MediaStream | null>(null);
  const recognitionStreamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const lastDetectAtRef = useRef<number>(0);
  const faceDetectedRef = useRef<boolean>(false);

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
        attendance_status: item.attendance_status
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
  const handleDateChange = useCallback((newDate: string) => {
    setSelectedDate(newDate);
    fetchCheckLogData(newDate);
  }, [fetchCheckLogData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCheckLogData(selectedDate, false);
  }, [selectedDate, fetchCheckLogData]);

  // Initial load
  useEffect(() => {
    fetchCheckLogData(selectedDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadEmployees = async () => {
      setEmployeeLoading(true);
      try {
        const response = await apiCall('/api/excel/employees/?page_size=1000', { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to load employees: ${response.status}`);
        }
        const data = await response.json();
        const employees = Array.isArray(data) ? data : (data?.results || []);
        setEmployeeOptions(
          employees.map((employee: any) => ({
            id: employee.id?.toString() || '',
            name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_id || 'Unknown',
          }))
        );
      } catch (err: any) {
        logger.error('Failed to load employees for face registration:', err);
      } finally {
        setEmployeeLoading(false);
      }
    };

    loadEmployees();
  }, []);

  useEffect(() => {
    if (activeTab !== 'recognition' || detectorRef.current || detectorLoading) return;
    const loadDetector = async () => {
      setDetectorLoading(true);
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        detectorRef.current = await faceDetection.createDetector(model, {
          runtime: 'tfjs',
          maxFaces: 1,
          modelType: 'short',
        });
        setDetectorReady(true);
      } catch (err) {
        logger.error('Failed to initialize face detector:', err);
      } finally {
        setDetectorLoading(false);
      }
    };

    loadDetector();
  }, [activeTab, detectorLoading]);

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

  const startCamera = async (
    videoRef: React.RefObject<HTMLVideoElement>,
    streamRef: React.MutableRefObject<MediaStream | null>
  ) => {
    if (!videoRef.current || streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err) {
      logger.error('Failed to access camera:', err);
    }
  };

  const captureFrame = async (videoRef: React.RefObject<HTMLVideoElement>): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.6));
  };

  useEffect(() => {
    const stopStream = (streamRef: React.MutableRefObject<MediaStream | null>) => {
      if (!streamRef.current) return;
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };

    if (activeTab === 'registration') {
      startCamera(registrationVideoRef, registrationStreamRef);
      stopStream(recognitionStreamRef);
    } else if (activeTab === 'recognition') {
      startCamera(recognitionVideoRef, recognitionStreamRef);
      stopStream(registrationStreamRef);
    } else {
      stopStream(registrationStreamRef);
      stopStream(recognitionStreamRef);
    }

    if (activeTab !== 'recognition') {
      setRecognitionActive(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!recognitionActive) return;
    let animationId = 0;
    let cancelled = false;

    const detectLoop = async () => {
      if (cancelled) return;
      animationId = requestAnimationFrame(detectLoop);

      if (!detectorRef.current || !recognitionVideoRef.current) return;
      if (recognitionInProgress) return;
      if (cooldownUntil && Date.now() < cooldownUntil) return;
      if (!detectorReady) return;

      const video = recognitionVideoRef.current;
      if (video.readyState < 2) return;

      const now = Date.now();
      if (now - lastDetectAtRef.current < 300) return;
      lastDetectAtRef.current = now;

      try {
        const faces = await detectorRef.current.estimateFaces(video, {
          flipHorizontal: false,
        });
        const hasFace = faces.length > 0;
        if (hasFace !== faceDetectedRef.current) {
          faceDetectedRef.current = hasFace;
          setFaceDetected(hasFace);
          if (hasFace) {
            setToast({ message: 'Face captured, sent for verification...', type: 'info' });
            handleRecognize('auto');
          }
        }
      } catch (err) {
        logger.error('Face detection error:', err);
      }
    };

    detectLoop();
    return () => {
      cancelled = true;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [recognitionActive, recognitionMode, recognitionInProgress, cooldownUntil, detectorReady]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRegisterFace = async () => {
    if (!selectedEmployeeId) {
      setRegistrationError('Please select an employee for registration.');
      return;
    }
    const blob = await captureFrame(registrationVideoRef);
    if (!blob) {
      setRegistrationError('Unable to capture photo. Make sure the camera is active.');
      return;
    }
    setRegistrationUploading(true);
    setRegistrationError(null);
    try {
      const formData = new FormData();
      formData.append('employee_id', selectedEmployeeId);
      formData.append('image', blob, `face-${Date.now()}.jpg`);
      const response = await apiUpload('/api/face-registration/', formData);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to register face');
      }
      setRegistrationPreview(URL.createObjectURL(blob));
    } catch (err: any) {
      setRegistrationError(err.message || 'Failed to register face');
    } finally {
      setRegistrationUploading(false);
    }
  };

  const handleRecognize = async (source: 'auto' | 'manual') => {
    if (recognitionInProgress) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    const blob = await captureFrame(recognitionVideoRef);
    if (!blob) return;
    setRecognitionInProgress(true);
    setToast({ message: 'Face captured, verifying...', type: 'info' });
    try {
      const formData = new FormData();
      formData.append('mode', recognitionMode);
      formData.append('image', blob, `recognition-${Date.now()}.jpg`);
      const response = await apiUpload('/api/face-recognition/', formData);
      const data = await response.json();
      if (response.ok && data?.recognized) {
        const message = `${data.employee_name} marked ${recognitionMode.replace('_', ' ')}`;
        setLastRecognitionStatus('success');
        setToast({ message: 'Face verified and attendance marked.', type: 'success' });
        setRecognitionLog((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success',
            message,
          },
          ...prev,
        ]);
        setCooldownUntil(Date.now() + 8000);
      } else {
        setLastRecognitionStatus('failed');
        if (source === 'manual') {
          setToast({ message: data?.message || 'Face not recognized.', type: 'error' });
          setRecognitionLog((prev) => [
            {
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              timestamp: new Date().toLocaleTimeString(),
              status: 'failed',
              message: data?.message || 'Face not recognized',
            },
            ...prev,
          ]);
        }
      }
    } catch (err: any) {
      setLastRecognitionStatus('failed');
      setToast({ message: err.message || 'Recognition failed.', type: 'error' });
      if (source === 'manual') {
        setRecognitionLog((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'failed',
            message: err.message || 'Recognition failed',
          },
          ...prev,
        ]);
      }
    } finally {
      setRecognitionInProgress(false);
    }
  };

  const renderCheckLog = () => (
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
                  {checkLogData.filter(item => item.check_in).length}
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
                  {checkLogData.filter(item => item.check_out).length}
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
                  {checkLogData.filter(item => !item.check_in).length}
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

  const renderRegistration = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Face Registration</h2>
        <p className="text-gray-600 mt-1">Register employee faces using the webcam.</p>
        <div className="grid gap-6 mt-6 md:grid-cols-[240px_1fr]">
          <div>
            <label className="text-sm font-medium text-gray-700">Select Employee</label>
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              disabled={employeeLoading}
            >
              <option value="">Choose employee</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-900 flex items-center justify-center aspect-square max-w-[360px] w-full">
              <video
                ref={registrationVideoRef}
                className="w-full h-full object-cover object-center"
                muted
                playsInline
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegisterFace}
                disabled={registrationUploading || !selectedEmployeeId}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {registrationUploading ? 'Registering...' : 'Register Face'}
              </button>
              {registrationPreview && (
                <img src={registrationPreview} alt="Registered" className="h-14 w-14 rounded-lg object-cover border" />
              )}
            </div>
            {registrationError && (
              <p className="text-sm text-red-600">{registrationError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecognition = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Face Recognition</h2>
            <p className="text-gray-600 mt-1">Use webcam to auto mark clock-in/out.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRecognitionMode('clock_in')}
              className={`px-4 py-2 rounded-lg border ${recognitionMode === 'clock_in' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-700'}`}
            >
              Clock In
            </button>
            <button
              onClick={() => setRecognitionMode('clock_out')}
              className={`px-4 py-2 rounded-lg border ${recognitionMode === 'clock_out' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-700'}`}
            >
              Clock Out
            </button>
          </div>
        </div>
        <div className="grid gap-6 mt-6 md:grid-cols-[1fr_280px]">
          <div
            className={`rounded-xl border-2 overflow-hidden bg-gray-900 flex items-center justify-center aspect-square max-w-[420px] w-full ${
              faceDetected ? 'border-green-500' : 'border-red-500'
            }`}
          >
            <video
              ref={recognitionVideoRef}
              className="w-full h-full object-cover object-center"
              muted
              playsInline
            />
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setRecognitionActive((prev) => !prev)}
              disabled={!detectorReady || detectorLoading}
              className={`w-full px-4 py-2 rounded-lg font-medium ${recognitionActive ? 'bg-red-500 text-white' : 'bg-teal-600 text-white'} ${(!detectorReady || detectorLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {detectorLoading ? 'Loading Face Detector...' : (recognitionActive ? 'Stop Auto Capture' : 'Start Auto Capture')}
            </button>
            <button
              onClick={() => handleRecognize('manual')}
              disabled={recognitionInProgress}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
            >
              Capture Now
            </button>
            {!detectorReady && !detectorLoading && (
              <p className="text-xs text-red-500">Face detector failed to load. Refresh the page.</p>
            )}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm font-medium text-gray-700">Recent Activity</p>
              <p className="text-xs text-gray-500 mt-1">
                Total Attempts: {recognitionLog.length}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Success: {recognitionLog.filter(entry => entry.status === 'success').length}
              </p>
              <p className="text-xs text-red-600">
                Failed: {recognitionLog.filter(entry => entry.status === 'failed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Recognition Log</h3>
          <button
            onClick={() => setRecognitionLog([])}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear Log
          </button>
        </div>
        <div className="p-6 space-y-3">
          {recognitionLog.length === 0 ? (
            <p className="text-sm text-gray-500">No recognition activity yet.</p>
          ) : (
            recognitionLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.message}</p>
                  <p className="text-xs text-gray-500">{entry.timestamp}</p>
                </div>
                <span className={`text-xs font-semibold ${entry.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.status === 'success' ? 'Success' : 'Failed'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setActiveTab('check-log')}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'check-log' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Check Log
          </button>
          <button
            onClick={() => setActiveTab('registration')}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'registration' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Registration
          </button>
          <button
            onClick={() => setActiveTab('recognition')}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'recognition' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Recognition
          </button>
        </div>
      </div>

      {activeTab === 'check-log' && renderCheckLog()}
      {activeTab === 'registration' && renderRegistration()}
      {activeTab === 'recognition' && renderRecognition()}
    </div>
  );
};

export default HRDailyCheckLog;
