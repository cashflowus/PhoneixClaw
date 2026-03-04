import time

from services.execution.src.dedup import IntentDeduplicator


class TestIntentDeduplicator:
    def test_first_intent_is_not_duplicate(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        assert dd.is_duplicate("agent-1", "AAPL", "buy", 100.0) is False

    def test_same_intent_within_window_is_duplicate(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        dd.record("agent-1", "AAPL", "buy", 100.0)
        assert dd.is_duplicate("agent-1", "AAPL", "buy", 100.0) is True

    def test_same_intent_after_window_is_not_duplicate(self):
        dd = IntentDeduplicator(window_seconds=0.1)
        dd.record("agent-1", "AAPL", "buy", 100.0)
        time.sleep(0.15)
        assert dd.is_duplicate("agent-1", "AAPL", "buy", 100.0) is False

    def test_different_symbol_is_not_duplicate(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        dd.record("agent-1", "AAPL", "buy", 100.0)
        assert dd.is_duplicate("agent-1", "TSLA", "buy", 100.0) is False

    def test_check_and_record_returns_false_first_time(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        assert dd.check_and_record("a1", "SPY", "sell", 50.0) is False

    def test_check_and_record_returns_true_on_duplicate(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        dd.check_and_record("a1", "SPY", "sell", 50.0)
        assert dd.check_and_record("a1", "SPY", "sell", 50.0) is True

    def test_cache_size_tracks_entries(self):
        dd = IntentDeduplicator(window_seconds=10.0)
        dd.record("a1", "AAPL", "buy", 10.0)
        dd.record("a2", "TSLA", "sell", 20.0)
        assert dd.cache_size == 2

    def test_make_key_is_deterministic(self):
        k1 = IntentDeduplicator._make_key("a", "B", "buy", 1.0)
        k2 = IntentDeduplicator._make_key("a", "B", "buy", 1.0)
        assert k1 == k2
