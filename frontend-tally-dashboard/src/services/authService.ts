import { API_CONFIG } from "../config/apiConfig";
import { AuthResponse, User } from "../types/auth";
import { logger } from '../utils/logger';

const API_BASE = API_CONFIG.getApiUrl();
const getToken = () => localStorage.getItem("access");

// Self-service company signup
export async function signupCompany(data: {
  company_name: string;
  subdomain: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/public/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Company signup failed");
  }
  return res.json();
}

// Public login (auto-detects tenant)
export async function login(
  email: string,
  password: string,
  confirmRecovery: boolean = false
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/public/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, confirm_recovery: confirmRecovery }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    // For error responses, create an error with the full response data for better error handling
    const error = new Error(data.error || "Login failed");
    (error as any).responseData = data;
    throw error;
  }

  return data;
}

// Add team member to existing tenant
export async function register(
  data: Omit<User, "id" | "is_hr" | "is_admin"> & {
    password: string;
    password2: string;
  }
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "User registration failed");
  }
  return res.json();
}

export async function refreshToken(
  refresh: string
): Promise<{ access: string }> {
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function getProfile(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/profile/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateUserStatus(
  user: User,
  field: string,
  newValue: boolean
): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${user.id}/update_permissions/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ [field]: newValue }),
  });
  if (!res.ok) throw new Error("Failed to update user status");
}

/* Updated centralized logout function to use /api/auth/force-logout/ and include email in the payload */
export const logout = async () => {
  let email = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    email = user.email || '';
  } catch (error) {
    logger.error('Error parsing user data:', error);
  }

  try {
    const response = await fetch('/api/auth/force-logout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      logger.error('Force logout API failed');
    }
  } catch (error) {
    logger.error('Force logout error:', error);
  } finally {
    // Clear all auth data including session_key
    localStorage.clear();
    // Clear PIN verification flags from sessionStorage
    sessionStorage.removeItem('pin_verified');
    sessionStorage.removeItem('awaiting_pin');
    window.location.href = '/login';
  }
};

// Check if PIN is required for user
export async function checkPINRequired(email: string): Promise<{ pin_required: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/pin/check-required/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      // PIN feature not configured or backend not available
      console.log('PIN check failed, assuming PIN not required');
      return { pin_required: false };
    }
    return res.json();
  } catch (error) {
    // Network error or endpoint not available
    console.log('PIN check failed, assuming PIN not required');
    return { pin_required: false };
  }
}

// Get PIN status
export async function getPINStatus(): Promise<{ 
  has_pin: boolean; 
  pin_enabled: boolean; 
  is_locked: boolean; 
  locked_until: string | null 
}> {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    const res = await fetch(`${API_BASE}/pin/status/`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch PIN status');
    }
    return res.json();
  } catch (error) {
    logger.error('Error fetching PIN status:', error);
    throw error;
  }
}

// Setup or change PIN with retry logic
export async function setupPIN(
  pin: string, 
  password: string, 
  retries: number = 2
): Promise<{ 
  success: boolean; 
  message: string; 
  pin_enabled: boolean 
}> {
  const token = getToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/pin/setup/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin, password }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.message || errorData.error || 'Failed to setup PIN';
        
        // Don't retry on client errors (4xx) except 429 (rate limit) and 409 (conflict)
        if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 409) {
          throw new Error(errorMessage);
        }
        
        // For rate limit or conflict, wait before retry
        if ((res.status === 429 || res.status === 409) && attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error(errorMessage);
          continue;
        }
        
        throw new Error(errorMessage);
      }
      
      return res.json();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on network errors if it's the last attempt
      if (attempt === retries) {
        logger.error('Error setting up PIN (final attempt):', error);
        throw error;
      }
      
      // Retry on network errors with exponential backoff
      if (error.message && (
        error.message.includes('timeout') || 
        error.message.includes('network') ||
        error.message.includes('fetch')
      )) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        logger.warn(`PIN setup attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, throw immediately
      logger.error('Error setting up PIN:', error);
      throw error;
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Failed to setup PIN after retries');
}

// Health check
export async function healthCheck(): Promise<{
  status: string;
  version: string;
}> {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}
