# pin_auth.py
# PIN authentication endpoints for 2-layer authentication

import logging
import time
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CustomUser, UserPIN

logger = logging.getLogger(__name__)

# Rate limiting configuration for PIN setup
PIN_SETUP_RATE_LIMIT_COUNT = 5  # Maximum attempts per time window
PIN_SETUP_RATE_LIMIT_WINDOW = 300  # 5 minutes in seconds
PIN_SETUP_CACHE_PREFIX = 'pin_setup_rate_limit_'


class SetupPINView(APIView):
    """
    Setup or update PIN for authenticated user
    Requires current password for security
    Includes rate limiting and audit logging
    """
    permission_classes = [IsAuthenticated]
    
    def _check_rate_limit(self, user):
        """Check if user has exceeded rate limit for PIN setup attempts"""
        cache_key = f"{PIN_SETUP_CACHE_PREFIX}{user.id}"
        current_time = int(time.time())
        
        # Get attempt history
        attempt_history = cache.get(cache_key, [])
        
        # Filter out attempts older than the time window
        window_start = current_time - PIN_SETUP_RATE_LIMIT_WINDOW
        recent_attempts = [timestamp for timestamp in attempt_history if timestamp > window_start]
        
        # Check if limit exceeded
        if len(recent_attempts) >= PIN_SETUP_RATE_LIMIT_COUNT:
            oldest_attempt = min(recent_attempts)
            time_remaining = (oldest_attempt + PIN_SETUP_RATE_LIMIT_WINDOW) - current_time
            return False, time_remaining
        
        return True, 0
    
    def _record_attempt(self, user):
        """Record a PIN setup attempt for rate limiting"""
        cache_key = f"{PIN_SETUP_CACHE_PREFIX}{user.id}"
        current_time = int(time.time())
        
        # Get current attempt history
        attempt_history = cache.get(cache_key, [])
        
        # Add current timestamp
        attempt_history.append(current_time)
        
        # Filter out old attempts
        window_start = current_time - PIN_SETUP_RATE_LIMIT_WINDOW
        attempt_history = [timestamp for timestamp in attempt_history if timestamp > window_start]
        
        # Store in cache with expiry
        cache.set(cache_key, attempt_history, PIN_SETUP_RATE_LIMIT_WINDOW + 60)
    
    def post(self, request):
        user = request.user
        pin = request.data.get('pin')
        password = request.data.get('password')
        
        # Validate inputs
        if not pin or not password:
            return Response(
                {'error': 'PIN and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify PIN format
        if len(str(pin)) != 4 or not str(pin).isdigit():
            return Response(
                {'error': 'PIN must be exactly 4 digits'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check rate limit
        can_proceed, time_remaining = self._check_rate_limit(user)
        if not can_proceed:
            minutes_remaining = (time_remaining + 59) // 60  # Round up to minutes
            logger.warning(f"Rate limit exceeded for PIN setup by user {user.email}. {minutes_remaining} minutes remaining.")
            return Response(
                {'error': f'Too many PIN setup attempts. Please try again in {minutes_remaining} minute(s).'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Verify current password
        if not user.check_password(password):
            # Record failed attempt for rate limiting
            self._record_attempt(user)
            logger.warning(f"Invalid password provided for PIN setup by user {user.email}")
            return Response(
                {'error': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Check if PIN is already set and enabled (validation before setup)
            if hasattr(user, 'pin_auth') and user.pin_auth.is_enabled:
                logger.info(f"PIN update requested for user {user.email} (PIN already enabled)")
            
            # Use transaction to ensure atomicity
            with transaction.atomic():
                # Get or create UserPIN with race condition handling
                try:
                    user_pin, created = UserPIN.objects.get_or_create(user=user)
                except IntegrityError:
                    # Race condition: another request created it, just get it
                    logger.warning(f"Race condition detected for user {user.email}, retrieving existing UserPIN")
                    user_pin = UserPIN.objects.get(user=user)
                    created = False
                
                # Set the PIN
                user_pin.set_pin(pin)
                
                # Enable PIN authentication
                user_pin.is_enabled = True
                user_pin.save()
            
            # Record successful attempt (for audit)
            self._record_attempt(user)
            
            # Audit logging
            action = 'created' if created else 'updated'
            logger.info(
                f"PIN {action} successfully for user {user.email} (user_id: {user.id}, "
                f"tenant: {user.tenant.name if user.tenant else 'N/A'})"
            )
            
            return Response({
                'success': True,
                'message': 'PIN setup successfully',
                'pin_enabled': True
            })
            
        except ValueError as e:
            self._record_attempt(user)
            logger.error(f"Validation error setting up PIN for user {user.email}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            self._record_attempt(user)
            logger.error(f"IntegrityError setting up PIN for user {user.email}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'PIN setup conflict. Please try again.'},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            self._record_attempt(user)
            logger.error(f"Error setting up PIN for user {user.email}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to setup PIN. Please try again or contact support.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VerifyPINView(APIView):
    """
    Verify PIN after successful password login
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        pin = request.data.get('pin')
        
        # Validate inputs
        if not email or not pin:
            return Response(
                {'error': 'Email and PIN are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get user
            user = CustomUser.objects.get(email=email)
            
            # Check if user has PIN enabled
            if not hasattr(user, 'pin_auth') or not user.pin_auth.is_enabled:
                return Response(
                    {'error': 'PIN authentication not enabled for this user'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify PIN
            success, message = user.pin_auth.verify_pin(pin)
            
            if success:
                logger.info(f"PIN verified successfully for user {user.email}")
                return Response({
                    'success': True,
                    'message': message,
                    'user_id': user.id,
                    'email': user.email
                })
            else:
                logger.warning(f"Failed PIN attempt for user {user.email}: {message}")
                return Response(
                    {'error': message},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error verifying PIN: {str(e)}")
            return Response(
                {'error': 'Failed to verify PIN'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DisablePINView(APIView):
    """
    Disable PIN authentication for user
    Requires current password for security
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        password = request.data.get('password')
        
        # Validate password
        if not password:
            return Response(
                {'error': 'Password is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify current password
        if not user.check_password(password):
            return Response(
                {'error': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Check if user has PIN
            if not hasattr(user, 'pin_auth'):
                return Response(
                    {'error': 'PIN not setup for this user'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Disable PIN
            user.pin_auth.is_enabled = False
            user.pin_auth.save()
            
            # Audit logging
            logger.info(
                f"PIN disabled for user {user.email} (user_id: {user.id}, "
                f"tenant: {user.tenant.name if user.tenant else 'N/A'})"
            )
            
            return Response({
                'success': True,
                'message': 'PIN authentication disabled',
                'pin_enabled': False
            })
            
        except Exception as e:
            logger.error(f"Error disabling PIN for user {user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to disable PIN'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PINStatusView(APIView):
    """
    Check if PIN authentication is enabled for user
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            if getattr(user, 'role', None) == 'gate_keeper':
                return Response({
                    'has_pin': False,
                    'pin_enabled': False,
                    'is_locked': False,
                    'locked_until': None
                })
            # Check if user has PIN setup
            has_pin = hasattr(user, 'pin_auth')
            is_enabled = has_pin and user.pin_auth.is_enabled
            is_locked = has_pin and user.pin_auth.is_locked()
            
            locked_until = None
            if is_locked and user.pin_auth.locked_until:
                locked_until = user.pin_auth.locked_until.isoformat()
            
            return Response({
                'has_pin': has_pin,
                'pin_enabled': is_enabled,
                'is_locked': is_locked,
                'locked_until': locked_until
            })
            
        except Exception as e:
            logger.error(f"Error checking PIN status for user {user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to check PIN status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CheckPINRequiredView(APIView):
    """
    Check if PIN is required for a user (used after password login)
    Superusers are excluded from PIN verification
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = CustomUser.objects.get(email=email)
            
            # Superusers don't need PIN verification
            if user.is_superuser:
                return Response({
                    'pin_required': False,
                    'email': email,
                    'is_superuser': True
                })

            # Gate keepers do not require PIN verification
            if getattr(user, 'role', None) == 'gate_keeper':
                return Response({
                    'pin_required': False,
                    'email': email,
                    'is_superuser': False
                })
            
            # Check if user has PIN enabled
            pin_required = hasattr(user, 'pin_auth') and user.pin_auth.is_enabled
            
            return Response({
                'pin_required': pin_required,
                'email': email,
                'is_superuser': False
            })
            
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error checking PIN requirement: {str(e)}")
            return Response(
                {'error': 'Failed to check PIN requirement'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
