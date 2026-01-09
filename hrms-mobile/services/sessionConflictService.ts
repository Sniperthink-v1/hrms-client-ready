/**
 * Session Conflict Detection Service
 * Uses polling to detect session conflicts since React Native doesn't support native EventSource
 */

import { API_BASE_URL, API_ENDPOINTS } from '@/constants/Config';
import { storage } from '@/utils/storage';

export interface SessionConflictData {
  show: boolean;
  message: string;
  reason: string;
}

export type SessionConflictHandler = (data: SessionConflictData) => void;

class SessionConflictService {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private handlers: SessionConflictHandler[] = [];
  private isPolling = false;
  private pollIntervalMs = 30000; // Poll every 30 seconds
  private lastSessionKey: string | null = null;

  /**
   * Start polling for session conflicts
   */
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      console.log('[SessionConflict] Already polling');
      return;
    }

    const accessToken = await storage.getAccessToken();
    if (!accessToken) {
      console.log('[SessionConflict] No access token, skipping polling');
      return;
    }

    this.lastSessionKey = await storage.getSessionKey();
    this.isPolling = true;

    console.log('[SessionConflict] Starting session polling...');

    // Initial check
    await this.checkSessionStatus();

    // Start periodic polling
    this.pollInterval = setInterval(async () => {
      await this.checkSessionStatus();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('[SessionConflict] Stopped polling');
  }

  /**
   * Check session status with the server
   */
  private async checkSessionStatus(): Promise<void> {
    try {
      const accessToken = await storage.getAccessToken();
      const sessionKey = await storage.getSessionKey();
      const tenant = await storage.getTenant();

      if (!accessToken || !sessionKey) {
        console.log('[SessionConflict] Missing token or session key');
        return;
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
      };

      if (tenant?.subdomain) {
        headers['X-Tenant-Subdomain'] = tenant.subdomain;
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.sessionStatus}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_key: sessionKey }),
      });

      if (response.status === 401) {
        // Token expired or invalid - could be a session conflict
        const data = await response.json().catch(() => ({}));
        
        if (data.logout_required || data.code === 'SESSION_INVALID') {
          console.log('[SessionConflict] Session invalidated by server');
          this.emitConflict({
            show: true,
            message: data.reason || 'Your session has been terminated due to another login.',
            reason: data.reason || 'SESSION_CONFLICT',
          });
        }
        return;
      }

      if (response.ok) {
        const data = await response.json();
        
        // Check if session is still valid
        if (data.valid === false || data.session_invalid === true) {
          console.log('[SessionConflict] Session marked as invalid');
          
          let message = 'Another login was detected. ';
          if (data.reason?.includes('same IP')) {
            message += 'Someone else logged in from this IP address.';
          } else if (data.reason?.includes('another location')) {
            message += 'You logged in from another location.';
          } else {
            message += data.reason || 'Your session has been terminated.';
          }

          this.emitConflict({
            show: true,
            message,
            reason: data.reason || 'SESSION_CONFLICT',
          });
        }
      }
    } catch (error) {
      // Network error - don't treat as session conflict
      console.log('[SessionConflict] Network error during status check:', error);
    }
  }

  /**
   * Register a handler for session conflicts
   */
  onConflict(handler: SessionConflictHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Unregister a handler
   */
  offConflict(handler: SessionConflictHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Emit conflict to all registered handlers
   */
  private emitConflict(data: SessionConflictData): void {
    console.log('[SessionConflict] Emitting conflict to handlers:', data);
    this.handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('[SessionConflict] Handler error:', err);
      }
    });
  }

  /**
   * Check if currently polling
   */
  isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Force check session status immediately
   */
  async forceCheck(): Promise<void> {
    await this.checkSessionStatus();
  }

  /**
   * Update poll interval (in milliseconds)
   */
  setPollInterval(intervalMs: number): void {
    this.pollIntervalMs = intervalMs;
    
    // Restart polling if active
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling();
    }
  }
}

// Export singleton instance
export const sessionConflictService = new SessionConflictService();
