"""Consistent error envelope: `{"error": {"code", "message", "details"}}`."""
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class BusinessRuleError(exceptions.APIException):
    """A request that is well-formed but not allowed by marketplace rules."""

    status_code = status.HTTP_409_CONFLICT
    default_code = 'business_rule'
    default_detail = 'This action is not allowed right now.'

    def __init__(self, message=None, code=None):
        super().__init__(detail=message or self.default_detail, code=code or self.default_code)
        self.error_code = code or self.default_code


def _first_message(detail):
    if isinstance(detail, list) and detail:
        return _first_message(detail[0])
    if isinstance(detail, dict) and detail:
        key, value = next(iter(detail.items()))
        msg = _first_message(value)
        return msg if key in ('non_field_errors', 'detail') else f'{key}: {msg}'
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, 'error_code', None)
    if code is None:
        codes = exc.get_codes() if hasattr(exc, 'get_codes') else 'error'
        code = codes if isinstance(codes, str) else 'invalid'
    details = response.data if isinstance(exc, exceptions.ValidationError) else None
    return Response(
        {'error': {'code': code, 'message': _first_message(response.data), 'details': details}},
        status=response.status_code,
        headers=getattr(response, 'headers', None) and dict(response.headers),
    )
