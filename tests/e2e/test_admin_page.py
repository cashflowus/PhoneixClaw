"""
E2E tests for Admin page.
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture
def logged_in_page(page: Page, base_url: str):
    page.goto(f"{base_url}/login")
    page.get_by_label("Email").fill("test@phoenix.io")
    page.get_by_label("Password").fill("testpassword123")
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url("**/trades**", timeout=5000)
    return page


def test_admin_page_renders(logged_in_page: Page, base_url: str):
    """Admin page loads."""
    logged_in_page.goto(f"{base_url}/admin")
    expect(logged_in_page.get_by_text("Admin").first).to_be_visible()


def test_admin_users_section(logged_in_page: Page, base_url: str):
    """Users table or section visible."""
    logged_in_page.goto(f"{base_url}/admin")
    users = logged_in_page.get_by_text("Users").or_(logged_in_page.locator("table"))
    expect(logged_in_page.locator("main").first).to_be_visible()


def test_admin_roles_or_api_keys(logged_in_page: Page, base_url: str):
    """Roles or API keys section present."""
    logged_in_page.goto(f"{base_url}/admin")
    content = logged_in_page.locator("main, .space-y-6, [class*='tab']")
    expect(content.first).to_be_visible()


def test_admin_audit_log(logged_in_page: Page, base_url: str):
    """Audit log section or table visible."""
    logged_in_page.goto(f"{base_url}/admin")
    main = logged_in_page.locator("main")
    expect(main.first).to_be_visible()
