from services.sentiment_analyzer.src.spam_filter import should_filter


class TestSpamFilter:
    def test_bot_message_filtered(self):
        assert should_filter({"is_bot": True, "content": "Hello"}) is True

    def test_short_message_filtered(self):
        assert should_filter({"is_bot": False, "content": "Hi"}) is True

    def test_normal_message_passes(self):
        assert should_filter({"is_bot": False, "content": "I think AAPL is going to break out above 200 soon"}) is False


class TestTickerExtractor:
    def test_extracts_common_tickers(self):
        from shared.nlp.ticker_extractor import TickerExtractor
        ext = TickerExtractor()
        tickers = ext.extract("AAPL is going up, TSLA looking good too")
        assert "AAPL" in tickers
        assert "TSLA" in tickers

    def test_no_tickers(self):
        from shared.nlp.ticker_extractor import TickerExtractor
        ext = TickerExtractor()
        tickers = ext.extract("The weather is nice today")
        assert len(tickers) == 0

    def test_filters_common_words(self):
        from shared.nlp.ticker_extractor import TickerExtractor
        ext = TickerExtractor()
        tickers = ext.extract("I am going to buy it for real")
        assert "I" not in tickers
        assert "AM" not in tickers
        assert "IT" not in tickers
        assert "FOR" not in tickers


class TestSentimentClassifier:
    def test_classify_returns_sentiment_result(self):
        from shared.nlp.sentiment_classifier import SentimentClassifier, SentimentLevel
        clf = SentimentClassifier()
        result = clf.classify("AAPL is doing great, earnings beat expectations!")
        assert result.level in (
            SentimentLevel.VERY_BULLISH, SentimentLevel.BULLISH,
            SentimentLevel.NEUTRAL,
            SentimentLevel.BEARISH, SentimentLevel.VERY_BEARISH,
        )
        assert -1.0 <= result.score <= 1.0
        assert 0.0 <= result.confidence <= 1.0


class TestMarketCalendar:
    def test_is_market_open_returns_bool(self):
        from shared.market.calendar import MarketCalendar
        cal = MarketCalendar()
        result = cal.is_market_open()
        assert isinstance(result, bool)

    def test_next_market_open_returns_datetime(self):
        from shared.market.calendar import MarketCalendar
        cal = MarketCalendar()
        result = cal.next_market_open()
        assert result is not None
