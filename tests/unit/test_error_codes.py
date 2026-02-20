from shared.error_codes import ErrorCode


class TestErrorCodes:
    def test_all_codes_are_strings(self):
        for code in ErrorCode:
            assert isinstance(code.value, str)

    def test_expected_codes_exist(self):
        expected = [
            "BROKER_TIMEOUT", "BROKER_REJECTED", "INSUFFICIENT_BUYING_POWER",
            "RATE_LIMITED", "VALIDATION_FAILED", "POSITION_NOT_FOUND",
            "BLACKLISTED", "KILL_SWITCH", "PARSE_ERROR", "DUPLICATE_MESSAGE",
        ]
        values = [c.value for c in ErrorCode]
        for exp in expected:
            assert exp in values, f"Missing error code: {exp}"
