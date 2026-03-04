"""
E2E tests for Market Command Center page.
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


def test_market_page_renders(logged_in_page: Page, base_url: str):
    """Market page loads with title."""
    logged_in_page.goto(f"{base_url}/market")
    expect(logged_in_page.get_by_text("Market").first).to_be_visible()


def test_market_indices_cards(logged_in_page: Page, base_url: str):
    """Market indices or metric cards visible."""
    logged_in_page.goto(f"{base_url}/market")
    cards = logged_in_page.locator("[class*='MetricCard'], [class*='grid'], .space-y-6")
    expect(cards.first).to_be_visible()


def test_market_chart_or_iframe(logged_in_page: Page, base_url: str):
    """Chart or TradingView iframe present."""
    logged_in_page.goto(f"{base_url}/market")
    chart = logged_in_page.locator("iframe, [class*='chart'], .aspect-")
    expect(chart.first).to_be_visible(timeout=5000)


def test_market_news_feed(logged_in_page: Page, base_url: str):
    """News feed or movers section visible."""
    logged_in_page.goto(f"{base_url}/market")
    news = logged_in_page.get_by_text("News").or_(logged_in_page.get_by_text("Movers"))
    expect(news.first).to_be_visible(timeout=3000)
