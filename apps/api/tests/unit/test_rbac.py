import pytest
from unittest.mock import MagicMock

from fastapi import HTTPException

from apps.api.src.middleware.rbac import (
    Permission,
    Role,
    ROLE_PERMISSIONS,
    check_permission,
    get_permissions_for_role,
    require_permission,
    require_role,
)


def _make_request(role="viewer", is_admin=False, permissions=None):
    req = MagicMock()
    req.state.role = role
    req.state.is_admin = is_admin
    req.state.permissions = permissions or []
    return req


class TestGetPermissionsForRole:
    def test_admin_has_all_permissions(self):
        perms = get_permissions_for_role("admin")
        assert perms == {p.value for p in Permission}

    def test_manager_permissions(self):
        perms = get_permissions_for_role("manager")
        assert "agents:create" in perms
        assert "trades:execute" in perms
        assert "admin:users" not in perms

    def test_trader_permissions(self):
        perms = get_permissions_for_role("trader")
        assert "trades:execute" in perms
        assert "connectors:manage" not in perms

    def test_viewer_permissions(self):
        perms = get_permissions_for_role("viewer")
        assert "agents:read" in perms
        assert "trades:read" in perms
        assert "trades:execute" not in perms

    def test_custom_role_empty_without_overrides(self):
        perms = get_permissions_for_role("custom")
        assert len(perms) == 0

    def test_custom_role_with_custom_permissions(self):
        perms = get_permissions_for_role("custom", ["trades:read", "agents:read"])
        assert "trades:read" in perms
        assert "agents:read" in perms

    def test_unknown_role_falls_back_to_viewer(self):
        perms = get_permissions_for_role("nonexistent")
        assert perms == get_permissions_for_role("viewer")


class TestCheckPermission:
    def test_admin_always_has_permission(self):
        req = _make_request(role="viewer", is_admin=True)
        assert check_permission(req, Permission.ADMIN_USERS) is True

    def test_trader_has_trades_execute(self):
        req = _make_request(role="trader")
        assert check_permission(req, Permission.TRADES_EXECUTE) is True

    def test_viewer_lacks_trades_execute(self):
        req = _make_request(role="viewer")
        assert check_permission(req, Permission.TRADES_EXECUTE) is False

    def test_custom_role_with_permissions(self):
        req = _make_request(role="custom", permissions=["skills:manage"])
        assert check_permission(req, Permission.SKILLS_MANAGE) is True


class TestRequirePermission:
    def test_raises_403_when_missing(self):
        req = _make_request(role="viewer")
        dep = require_permission(Permission.ADMIN_USERS)
        with pytest.raises(HTTPException) as exc_info:
            dep(req)
        assert exc_info.value.status_code == 403

    def test_passes_when_present(self):
        req = _make_request(role="admin")
        dep = require_permission(Permission.ADMIN_USERS)
        dep(req)


class TestRequireRole:
    def test_raises_403_for_wrong_role(self):
        req = _make_request(role="viewer")
        dep = require_role(Role.ADMIN, Role.MANAGER)
        with pytest.raises(HTTPException) as exc_info:
            dep(req)
        assert exc_info.value.status_code == 403

    def test_passes_for_matching_role(self):
        req = _make_request(role="admin")
        dep = require_role(Role.ADMIN)
        dep(req)
