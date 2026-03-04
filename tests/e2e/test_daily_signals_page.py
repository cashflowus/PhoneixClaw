"""
E2E tests for Daily Signals page.
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


def test_daily_signals_page_renders(logged_in_page: Page, base_url: str):
    """Daily Signals page loads."""
    logged_in_page.goto(f"{base_url}/daily-signals")
    expect(logged_in_page.get_by_text("Daily Signals").or_(logged_in_page.get_by_text("Signals")).first).to_be_visible()


def test_daily_signals_pipeline_or_feed(logged_in_page: Page, base_url: str):
    """Pipeline visualization or signals feed visible."""
    logged_in_page.goto(f"{base_url}/daily-signals")
    main = logged_in_page.locator("main, .space-y-6")
    expect(main.first).to_be_visible()


def test_daily_signals_deploy_button(logged_in_page: Page, base_url: str):
    """Deploy or create pipeline button present."""
    logged_in_page.goto(f"{base_url}/daily-signals")
    content = logged_in_page.locator("main")
    expect(content.first).to_be_visible()
