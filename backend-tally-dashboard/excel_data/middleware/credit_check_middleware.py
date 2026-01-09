"""
Credit Check Middleware
Automatically checks and deducts missed credits when the server wakes up or on any request.
This ensures credits are deducted even when the server sleeps (e.g., Railway sleep mode).
"""

import logging
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache

logger = logging.getLogger(__name__)


class AutoCreditDeductionMiddleware(MiddlewareMixin):
    """
    Middleware to automatically check and deduct credits for tenants on user requests.
    
    This provides immediate credit checks when users access the system,
    working alongside the background scheduler for comprehensive coverage.
    
    How it works:
    1. On each authenticated request, checks if the tenant needs credit deduction
    2. Attempts to deduct credit (will only succeed if not already deducted today)
    3. Uses brief cache (5 min) to prevent excessive checks during request bursts
    """
    
    CACHE_PREFIX = 'credit_checked_'
    CACHE_TIMEOUT = 300  # 5 minutes - just to prevent excessive DB queries
    
    def process_request(self, request):
        """
        Process incoming request and check credits if needed.
        """
        try:
            # Only check credits for authenticated users
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return None
            
            # Skip credit checks for superusers
            if request.user.is_superuser:
                return None
            
            # Get tenant from user
            if not hasattr(request.user, 'tenant') or not request.user.tenant:
                return None
            
            tenant = request.user.tenant
            
            # Check cache to prevent excessive DB hits in quick succession
            cache_key = f"{self.CACHE_PREFIX}{tenant.id}"
            recently_checked = cache.get(cache_key)
            
            if recently_checked:
                # Already checked in last 5 minutes, skip
                return None
            
            # Attempt to deduct credit (will check last_credit_deducted internally)
            was_deducted = tenant.deduct_daily_credit()
            
            if was_deducted:
                logger.info(
                    f"✅ [Middleware] Auto-deducted credit for tenant '{tenant.name}' (ID: {tenant.id}). "
                    f"Remaining credits: {tenant.credits}"
                )
            
            # Mark as checked in cache
            cache.set(cache_key, True, self.CACHE_TIMEOUT)
            
        except Exception as e:
            # Log error but don't block the request
            logger.error(f"Error in AutoCreditDeductionMiddleware: {str(e)}", exc_info=True)
        
        return None


class CreditEnforcementMiddleware(MiddlewareMixin):
    """
    Middleware to block protected endpoints when tenant has no credits.
    
    Allows login and access to settings/support, but blocks all other protected endpoints.
    """
    
    # URLs that don't require credits (always accessible)
    EXEMPT_PATHS = [
        '/admin/',
        '/api/auth/login/',
        '/api/auth/register/',
        '/api/auth/logout/',
        '/api/auth/password/',
        '/api/auth/refresh/',
        '/api/public/login/',
        '/api/public/signup/',
        '/api/health/',
        '/api/super-admin/',  # Super admin endpoints don't require credit checks
        '/api/pin/',  # PIN endpoints are accessible
        '/api/user/profile/',  # User profile is accessible
        '/api/tenant/settings/',  # Settings are accessible
        '/api/support/',  # Support endpoints are accessible
        '/static/',
        '/media/',
    ]
    
    # Protected endpoints that require credits
    PROTECTED_PATHS = [
        '/api/employees/',
        '/api/attendance/',
        '/api/daily-attendance/',
        '/api/salary-data/',
        '/api/payroll/',
        '/api/payroll-periods/',
        '/api/calculated-salaries/',
        '/api/advance-payments/',
        '/api/advance-ledger/',
        '/api/leaves/',
        '/api/holidays/',
        '/api/departments/',
        '/api/dashboard/',
        '/api/reports/',
        '/api/upload-salary/',
        '/api/upload-attendance/',
        '/api/download-template/',
        '/api/download-attendance-template/',
    ]
    
    CACHE_PREFIX = 'deletion_checked_'
    CACHE_TIMEOUT = 300  # 5 minutes - just to prevent excessive checks
    
    def process_request(self, request):
        """
        Block protected endpoints when tenant has no credits.
        """
        from django.http import JsonResponse
        
        try:
            # Check if path is exempt (always accessible)
            path = request.path
            if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
                return None
            
            # Only enforce for authenticated users
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return None
            
            # Skip credit enforcement for superusers
            if request.user.is_superuser:
                return None
            
            # Check if user has tenant
            if not hasattr(request.user, 'tenant') or not request.user.tenant:
                return None
            
            tenant = request.user.tenant
            
            # Check if this is a protected endpoint
            is_protected = any(path.startswith(protected) for protected in self.PROTECTED_PATHS)
            
            # Block protected endpoints if credits are 0
            if is_protected and tenant.credits <= 0:
                logger.warning(
                    f"🚫 Blocked access to {path} for tenant '{tenant.name}' (ID: {tenant.id}) - No credits"
                )
                return JsonResponse(
                    {
                        "error": "Company account has no credits. Please contact support to add credits to your account.",
                        "no_credits": True,
                        "credits": tenant.credits,
                    },
                    status=403,
                )
            
            # Check for expired accounts that should be permanently deleted
            # Use cache to prevent excessive checks
            cache_key = f"{self.CACHE_PREFIX}{tenant.id}"
            recently_checked = cache.get(cache_key)
            
            if not recently_checked and tenant.deactivated_at:
                # Check if account should be permanently deleted
                if tenant.should_permanently_delete():
                    try:
                        # Permanently delete the expired account
                        tenant.permanently_delete()
                        logger.warning(
                            f"🗑️ [Middleware] Permanently deleted expired account "
                            f"'{tenant.name}' (ID: {tenant.id}) during request"
                        )
                    except Exception as e:
                        logger.error(
                            f"Error permanently deleting tenant {tenant.id} in middleware: {str(e)}",
                            exc_info=True
                        )
                else:
                    # Mark as checked in cache (only if not expired)
                    cache.set(cache_key, True, self.CACHE_TIMEOUT)
            
            # Log warning if credits are low
            if tenant.credits <= 5 and tenant.credits > 0:
                logger.warning(
                    f"Low credits warning for tenant '{tenant.name}' (ID: {tenant.id}). "
                    f"Only {tenant.credits} credits remaining."
                )
            
        except Exception as e:
            logger.error(f"Error in CreditEnforcementMiddleware: {str(e)}", exc_info=True)
        
        return None
