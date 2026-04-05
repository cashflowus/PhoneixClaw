"""Unit tests for V3 permission system (apps.api.src.routes.auth).

Replaces V1 tests that imported ROLE_PRESETS from shared.models.trade (removed).
V3 uses a simplified permission model: DEFAULT_PERMISSIONS for regular users,
ADMIN_PERMISSIONS for admins, stored as JSONB on the User model.
"""

from apps.api.src.routes.auth import ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS


class TestDefaultPermissions:
    def test_default_permissions_exist(self):
        assert isinstance(DEFAULT_PERMISSIONS, dict)
        assert len(DEFAULT_PERMISSIONS) > 0

    def test_default_has_read_permissions(self):
        assert DEFAULT_PERMISSIONS.get("agents:read") is True
        assert DEFAULT_PERMISSIONS.get("trades:read") is True
        assert DEFAULT_PERMISSIONS.get("positions:read") is True

    def test_default_has_no_write_permissions(self):
        for key, val in DEFAULT_PERMISSIONS.items():
            if ":write" in key:
                assert val is not True, f"Default should not grant {key}"

    def test_default_has_no_admin_permissions(self):
        assert "admin:read" not in DEFAULT_PERMISSIONS
        assert "admin:write" not in DEFAULT_PERMISSIONS


class TestAdminPermissions:
    def test_admin_permissions_exist(self):
        assert isinstance(ADMIN_PERMISSIONS, dict)
        assert len(ADMIN_PERMISSIONS) > len(DEFAULT_PERMISSIONS)

    def test_admin_has_all_read_permissions(self):
        assert ADMIN_PERMISSIONS.get("agents:read") is True
        assert ADMIN_PERMISSIONS.get("trades:read") is True
        assert ADMIN_PERMISSIONS.get("positions:read") is True

    def test_admin_has_write_permissions(self):
        assert ADMIN_PERMISSIONS.get("agents:write") is True
        assert ADMIN_PERMISSIONS.get("trades:write") is True
        assert ADMIN_PERMISSIONS.get("positions:write") is True

    def test_admin_has_admin_permissions(self):
        assert ADMIN_PERMISSIONS.get("admin:read") is True
        assert ADMIN_PERMISSIONS.get("admin:write") is True

    def test_all_admin_values_are_true(self):
        for key, val in ADMIN_PERMISSIONS.items():
            assert val is True, f"{key} should be True in ADMIN_PERMISSIONS"


class TestPermissionModel:
    def test_user_model_has_permissions_column(self):
        from shared.db.models.user import User
        assert hasattr(User, "permissions")
        assert hasattr(User, "is_admin")
        assert hasattr(User, "role")
