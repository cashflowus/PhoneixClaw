"""Unit tests for V3 NLP modules (signal_parser + ticker_extractor).

Replaces the original tests that targeted the non-existent nlp-parser service.
"""

from shared.nlp.signal_parser import ParsedSignal, parse_signal
from shared.nlp.ticker_extractor import TickerExtractor


class TestTickerExtractor:
    def test_extracts_cashtag(self):
        ext = TickerExtractor()
        result = ext.extract("Buying $AAPL at 190")
        assert "AAPL" in result

    def test_extracts_option_format(self):
        ext = TickerExtractor()
        result = ext.extract("AAPL 190C 3/21")
        assert "AAPL" in result

    def test_deduplicates(self):
        ext = TickerExtractor()
        result = ext.extract("$AAPL is great, AAPL to the moon")
        assert result.count("AAPL") == 1

    def test_extract_primary(self):
        ext = TickerExtractor()
        result = ext.extract_primary("$TSLA calls looking good")
        assert result == "TSLA"

    def test_returns_none_for_no_ticker(self):
        ext = TickerExtractor()
        result = ext.extract_primary("the market is crazy today")
        assert result is None

    def test_filters_common_words(self):
        ext = TickerExtractor()
        result = ext.extract("I AM going TO BUY something")
        assert "AM" not in result
        assert "TO" not in result
        assert "BUY" not in result


class TestSignalParser:
    def test_buy_signal_detected(self):
        sig = parse_signal("BTO $AAPL 190C 3/21 @ 2.50")
        assert sig.signal_type == "buy_signal"
        assert "AAPL" in sig.tickers
        assert sig.confidence > 0.3

    def test_sell_signal_detected(self):
        sig = parse_signal("STC $TSLA sold at 250")
        assert sig.signal_type == "sell_signal"
        assert "TSLA" in sig.tickers

    def test_close_signal_detected(self):
        sig = parse_signal("Closed $SPY position, took profit at 500")
        assert sig.signal_type == "close_signal"
        assert "SPY" in sig.tickers

    def test_noise_detected(self):
        sig = parse_signal("good morning everyone, happy trading")
        assert sig.signal_type == "noise"
        assert sig.confidence < 0.3

    def test_info_with_ticker(self):
        sig = parse_signal("$NVDA earnings coming up next week")
        assert sig.signal_type == "info"
        assert "NVDA" in sig.tickers

    def test_price_extraction(self):
        sig = parse_signal("Bought $AAPL @ 192.50")
        assert sig.price == 192.50

    def test_option_extraction(self):
        sig = parse_signal("BTO AAPL 3/21 190C")
        assert sig.option_type == "C"
        assert sig.option_strike == 190.0
        assert sig.option_expiry == "3/21"

    def test_returns_parsed_signal_type(self):
        sig = parse_signal("some message")
        assert isinstance(sig, ParsedSignal)

    def test_confidence_increases_with_ticker_and_price(self):
        bare = parse_signal("buying something")
        with_ticker = parse_signal("buying $AAPL")
        with_both = parse_signal("buying $AAPL @ 190")
        assert with_ticker.confidence > bare.confidence
        assert with_both.confidence > with_ticker.confidence
