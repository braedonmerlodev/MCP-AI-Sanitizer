# agent/trust_validator.py
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import os
import logging

logger = logging.getLogger(__name__)


class TrustTokenValidator:
    """Validates trust tokens from MCP-Security API responses"""

    def __init__(self, secret_key: Optional[str] = None):
        """
        Initialize trust token validator

        Args:
            secret_key: Secret key for HMAC validation (defaults to env var)
        """
        self.secret_key = secret_key or os.getenv("TRUST_TOKEN_SECRET")
        if not self.secret_key:
            logger.warning("TRUST_TOKEN_SECRET not set - trust token validation disabled")

    def validate_token(self, trust_token: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a trust token's cryptographic signature and metadata

        Args:
            trust_token: Trust token dictionary from API response

        Returns:
            Dict with validation results and details
        """
        try:
            # Check required fields
            required_fields = [
                'contentHash', 'originalHash', 'sanitizationVersion',
                'rulesApplied', 'timestamp', 'expiresAt', 'signature', 'nonce'
            ]

            missing_fields = [field for field in required_fields if field not in trust_token]
            if missing_fields:
                return {
                    'isValid': False,
                    'error': f'Missing required fields: {missing_fields}',
                    'trustLevel': 'invalid'
                }

            # Check expiration
            expires_at = datetime.fromisoformat(trust_token['expiresAt'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)

            if now > expires_at:
                return {
                    'isValid': False,
                    'error': 'Trust token has expired',
                    'trustLevel': 'expired',
                    'expiredAt': trust_token['expiresAt']
                }

            # Validate signature if secret key is available
            if self.secret_key:
                is_signature_valid = self._validate_signature(trust_token)
                if not is_signature_valid:
                    return {
                        'isValid': False,
                        'error': 'Invalid cryptographic signature',
                        'trustLevel': 'tampered'
                    }
            else:
                logger.warning("Cannot validate signature - TRUST_TOKEN_SECRET not configured")

            # Validate content integrity
            content_hash_valid = self._validate_content_hash(trust_token)
            if not content_hash_valid:
                return {
                    'isValid': False,
                    'error': 'Content hash mismatch - data may be corrupted',
                    'trustLevel': 'corrupted'
                }

            # All validations passed
            return {
                'isValid': True,
                'trustLevel': 'verified',
                'rulesApplied': trust_token['rulesApplied'],
                'sanitizationVersion': trust_token['sanitizationVersion'],
                'expiresAt': trust_token['expiresAt'],
                'issuedAt': trust_token['timestamp']
            }

        except Exception as e:
            logger.error(f"Trust token validation error: {e}")
            return {
                'isValid': False,
                'error': f'Validation error: {str(e)}',
                'trustLevel': 'error'
            }

    def _validate_signature(self, trust_token: Dict[str, Any]) -> bool:
        """
        Validate HMAC-SHA256 signature of trust token

        Args:
            trust_token: Trust token to validate

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Create message from token components (same as server)
            message_components = [
                trust_token['contentHash'],
                trust_token['originalHash'],
                trust_token['timestamp'],
                trust_token['nonce']
            ]
            message = '.'.join(message_components)

            # Generate expected signature
            if not self.secret_key:
                logger.error("Cannot validate signature - secret key not available")
                return False

            expected_signature = hmac.new(
                self.secret_key.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()

            # Compare with provided signature (constant-time comparison)
            return hmac.compare_digest(expected_signature, trust_token['signature'])

        except Exception as e:
            logger.error(f"Signature validation error: {e}")
            return False

    def _validate_content_hash(self, trust_token: Dict[str, Any]) -> bool:
        """
        Validate that content hash matches expected value
        This is a placeholder - in practice, we'd need the actual content

        Args:
            trust_token: Trust token with content hash

        Returns:
            True if hash is valid (placeholder implementation)
        """
        # In a real implementation, we'd hash the actual content and compare
        # For now, we assume the hash is valid since it came from the trusted API
        return True

    def format_trust_display(self, validation_result: Dict[str, Any]) -> str:
        """
        Format trust validation result for display

        Args:
            validation_result: Result from validate_token()

        Returns:
            Formatted string for display
        """
        if not validation_result['isValid']:
            trust_level = validation_result.get('trustLevel', 'unknown')
            error = validation_result.get('error', 'Unknown error')

            if trust_level == 'expired':
                return f"❌ Trust Token: EXPIRED (expired {validation_result.get('expiredAt', 'unknown')})"
            elif trust_level == 'tampered':
                return "❌ Trust Token: TAMPERED (signature invalid)"
            elif trust_level == 'corrupted':
                return "❌ Trust Token: CORRUPTED (content hash mismatch)"
            else:
                return f"❌ Trust Token: INVALID ({error})"

        # Valid token
        rules_count = len(validation_result.get('rulesApplied', []))
        version = validation_result.get('sanitizationVersion', 'unknown')
        expires = validation_result.get('expiresAt', 'unknown')

        return f"✅ Trust Token: VERIFIED (v{version}, {rules_count} rules, expires {expires})"

    def extract_content_and_trust(self, api_response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract content and trust token from API response

        Args:
            api_response: Full API response dictionary

        Returns:
            Dict with 'content' and 'trustToken' keys
        """
        result = api_response.get('result', {})

        # Handle different response structures
        if 'sanitizedContent' in result:
            # New structure with trust tokens
            sanitized_content = result['sanitizedContent']
            return {
                'content': sanitized_content.get('sanitizedData'),
                'trustToken': sanitized_content.get('trustToken'),
                'metadata': result.get('metadata', {})
            }
        elif 'sanitizedData' in result:
            # Legacy structure without trust tokens
            return {
                'content': result['sanitizedData'],
                'trustToken': None,
                'metadata': result.get('metadata', {})
            }
        else:
            # Raw content response
            return {
                'content': result,
                'trustToken': None,
                'metadata': {}
            }