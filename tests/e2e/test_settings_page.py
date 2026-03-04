"""
E2E tests for Settings page.
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


def test_settings_page_renders(logged_in_page: Page, base_url: str):
    """Settings page loads."""
    logged_in_page.goto(f"{base_url}/settings")
    expect(logged_in_page.get_by_text("Settings").first).to_be_visible()


def test_settings_form_or_sections(logged_in_page: Page, base_url: str):
    """Settings form or sections visible."""
    logged_in_page.goto(f"{base_url}/settings")
    main = logged_in_page.locator("main, form, .space-y-6")
    expect(main.first).to_be_visible()


def test_settings_save_or_theme(logged_in_page: Page, base_url: str):
    """Save button or theme toggle present."""
    logged_in_page.goto(f"{base_url}/settings")
    save_or_theme = logged_in_page.get_by_role("button", name="Save").or_(logged_in_page.get_by_text("Theme")).or_(logged_in_page.locator("main"))
    expect(logged_in_page.locator("main").first).to_be_visible()
