import pytest

from services.automation.src.nl_parser import parse_schedule


class TestNLParser:
    def test_every_weekday_at_9am(self):
        assert parse_schedule("every weekday at 9am") == "0 9 * * 1-5"

    def test_every_hour(self):
        assert parse_schedule("every hour") == "0 * * * *"

    def test_every_monday_at_3pm(self):
        assert parse_schedule("every Monday at 3pm") == "0 15 * * 1"

    def test_every_5_minutes(self):
        assert parse_schedule("every 5 minutes") == "*/5 * * * *"

    def test_every_day_at_noon(self):
        assert parse_schedule("every day at 12pm") == "0 12 * * *"

    def test_at_market_open(self):
        assert parse_schedule("at market open") == "30 9 * * 1-5"

    def test_at_market_close(self):
        assert parse_schedule("at market close") == "0 16 * * 1-5"

    def test_invalid_raises_value_error(self):
        with pytest.raises(ValueError, match="Could not parse"):
            parse_schedule("something completely unknown")
