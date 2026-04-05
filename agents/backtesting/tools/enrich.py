"""Market enrichment pipeline: add ~200 attributes to each trade row.

Usage:
    python tools/enrich.py --input output/transformed.parquet --output output/enriched.parquet
"""

import argparse
import warnings
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Helpers ─────────────────────────────────────────────────────────────────


def _safe_download(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Download OHLCV data via yfinance with error handling."""
    try:
        import yfinance as yf
        data = yf.download(ticker, start=start, end=end, progress=False)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        return data
    except Exception:
        return pd.DataFrame()


def _calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _calc_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _calc_sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window).mean()


def _calc_macd(close: pd.Series):
    ema12 = _calc_ema(close, 12)
    ema26 = _calc_ema(close, 26)
    macd_line = ema12 - ema26
    signal = _calc_ema(macd_line, 9)
    hist = macd_line - signal
    return macd_line, signal, hist


def _calc_bollinger(close: pd.Series, window: int = 20, std_dev: int = 2):
    mid = _calc_sma(close, window)
    std = close.rolling(window).std()
    upper = mid + std_dev * std
    lower = mid - std_dev * std
    return upper, mid, lower


def _calc_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def _calc_stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k_period=14, d_period=3):
    lowest = low.rolling(k_period).min()
    highest = high.rolling(k_period).max()
    k = 100 * (close - lowest) / (highest - lowest).replace(0, np.nan)
    d = k.rolling(d_period).mean()
    return k, d


def _calc_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
    atr = _calc_atr(high, low, close, period)
    plus_di = 100 * _calc_ema(plus_dm, period) / atr.replace(0, np.nan)
    minus_di = 100 * _calc_ema(minus_dm, period) / atr.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return _calc_ema(dx, period)


# ── Main enrichment ─────────────────────────────────────────────────────────


def enrich_trade(row: pd.Series, cache: dict) -> dict:
    """Enrich a single trade row with ~200 market attributes."""
    ticker = row["ticker"]
    entry_time = pd.Timestamp(row["entry_time"])
    entry_date = entry_time.date() if hasattr(entry_time, "date") else entry_time

    # Get historical data (cached per ticker)
    end_str = str(entry_date)
    start_str = str(entry_date - timedelta(days=400))
    cache_key = f"{ticker}_{start_str}_{end_str}"

    if cache_key not in cache:
        cache[cache_key] = _safe_download(ticker, start_str, end_str)

    hist = cache[cache_key]
    if hist.empty or len(hist) < 30:
        return {}

    # Trim to data available before entry (no look-ahead)
    hist = hist[hist.index.date <= entry_date]
    if hist.empty or len(hist) < 20:
        return {}

    close = hist["Close"]
    high = hist["High"]
    low = hist["Low"]
    volume = hist["Volume"]
    opn = hist["Open"]

    attrs = {}

    # ── Category 1: Price Action ────────────────────────────────────────
    for d in [1, 3, 5, 10, 20]:
        attrs[f"close_{d}d"] = close.iloc[-min(d+1, len(close))] if len(close) > d else np.nan
        attrs[f"return_{d}d"] = (close.iloc[-1] - close.iloc[-min(d+1, len(close))]) / close.iloc[-min(d+1, len(close))] if len(close) > d else np.nan

    if len(close) >= 2:
        attrs["gap_pct"] = (opn.iloc[-1] - close.iloc[-2]) / close.iloc[-2]
        attrs["range_pct"] = (high.iloc[-1] - low.iloc[-1]) / close.iloc[-1]
        attrs["body_pct"] = abs(close.iloc[-1] - opn.iloc[-1]) / close.iloc[-1]

    atr = _calc_atr(high, low, close)
    attrs["atr_14"] = atr.iloc[-1] if not atr.empty else np.nan
    attrs["atr_pct"] = attrs["atr_14"] / close.iloc[-1] if close.iloc[-1] != 0 else np.nan

    for d in [5, 20]:
        attrs[f"high_{d}d"] = high.iloc[-d:].max() if len(high) >= d else np.nan
        attrs[f"low_{d}d"] = low.iloc[-d:].min() if len(low) >= d else np.nan

    if len(close) >= 252:
        h52 = high.iloc[-252:].max()
        l52 = low.iloc[-252:].min()
        attrs["dist_from_52w_high"] = (close.iloc[-1] - h52) / h52
        attrs["dist_from_52w_low"] = (close.iloc[-1] - l52) / l52

    greens = 0
    for i in range(2, min(11, len(close)+1)):
        if close.iloc[-i] < close.iloc[-i+1]:
            greens += 1
        else:
            break
    attrs["consecutive_green"] = greens

    # ── Category 2: Technical Indicators ────────────────────────────────
    for p in [7, 14, 21]:
        rsi = _calc_rsi(close, p)
        attrs[f"rsi_{p}"] = rsi.iloc[-1] if not rsi.empty else np.nan

    macd_line, macd_signal, macd_hist = _calc_macd(close)
    attrs["macd_line"] = macd_line.iloc[-1] if not macd_line.empty else np.nan
    attrs["macd_signal"] = macd_signal.iloc[-1] if not macd_signal.empty else np.nan
    attrs["macd_histogram"] = macd_hist.iloc[-1] if not macd_hist.empty else np.nan
    attrs["macd_cross_up"] = (macd_line.iloc[-1] > macd_signal.iloc[-1] and macd_line.iloc[-2] <= macd_signal.iloc[-2]) if len(macd_line) >= 2 else False

    bb_upper, bb_mid, bb_lower = _calc_bollinger(close)
    attrs["bb_upper"] = bb_upper.iloc[-1] if not bb_upper.empty else np.nan
    attrs["bb_middle"] = bb_mid.iloc[-1] if not bb_mid.empty else np.nan
    attrs["bb_lower"] = bb_lower.iloc[-1] if not bb_lower.empty else np.nan
    if not np.isnan(attrs.get("bb_upper", np.nan)) and (attrs["bb_upper"] - attrs["bb_lower"]) != 0:
        attrs["bb_position"] = (close.iloc[-1] - attrs["bb_lower"]) / (attrs["bb_upper"] - attrs["bb_lower"])
        attrs["bb_width"] = (attrs["bb_upper"] - attrs["bb_lower"]) / attrs["bb_middle"] if attrs["bb_middle"] != 0 else np.nan

    stoch_k, stoch_d = _calc_stochastic(high, low, close)
    attrs["stoch_k"] = stoch_k.iloc[-1] if not stoch_k.empty else np.nan
    attrs["stoch_d"] = stoch_d.iloc[-1] if not stoch_d.empty else np.nan
    attrs["adx_14"] = _calc_adx(high, low, close).iloc[-1]

    cci_period = 20
    if len(close) >= cci_period:
        tp = (high + low + close) / 3
        sma_tp = tp.rolling(cci_period).mean()
        mad = tp.rolling(cci_period).apply(lambda x: np.abs(x - x.mean()).mean())
        attrs["cci_20"] = ((tp.iloc[-1] - sma_tp.iloc[-1]) / (0.015 * mad.iloc[-1])) if mad.iloc[-1] != 0 else np.nan

    obv = (np.sign(close.diff()) * volume).fillna(0).cumsum()
    attrs["obv"] = obv.iloc[-1]
    attrs["obv_slope_5"] = (obv.iloc[-1] - obv.iloc[-min(6, len(obv))]) / 5 if len(obv) >= 5 else np.nan

    # ── Category 3: Moving Averages ─────────────────────────────────────
    for w in [5, 10, 20, 50, 100, 200]:
        sma = _calc_sma(close, w)
        ema = _calc_ema(close, w)
        attrs[f"sma_{w}"] = sma.iloc[-1] if len(close) >= w else np.nan
        attrs[f"ema_{w}"] = ema.iloc[-1] if len(close) >= w else np.nan

    for w in [20, 50, 200]:
        sma_val = attrs.get(f"sma_{w}", np.nan)
        if not np.isnan(sma_val) and sma_val != 0:
            attrs[f"dist_sma_{w}"] = (close.iloc[-1] - sma_val) / sma_val

    sma20 = attrs.get("sma_20", np.nan)
    sma50 = attrs.get("sma_50", np.nan)
    sma200 = attrs.get("sma_200", np.nan)
    attrs["sma_20_50_cross"] = float(sma20 > sma50) if not (np.isnan(sma20) or np.isnan(sma50)) else np.nan
    attrs["sma_50_200_cross"] = float(sma50 > sma200) if not (np.isnan(sma50) or np.isnan(sma200)) else np.nan
    attrs["above_all_sma"] = float(close.iloc[-1] > sma20 and close.iloc[-1] > sma50 and close.iloc[-1] > sma200) if not any(np.isnan(x) for x in [sma20, sma50, sma200]) else np.nan

    # ── Category 4: Volume ──────────────────────────────────────────────
    attrs["volume"] = volume.iloc[-1]
    vol_sma = _calc_sma(volume, 20)
    attrs["volume_sma_20"] = vol_sma.iloc[-1] if not vol_sma.empty else np.nan
    attrs["volume_ratio"] = volume.iloc[-1] / attrs["volume_sma_20"] if attrs.get("volume_sma_20", 0) > 0 else np.nan
    attrs["volume_breakout"] = float(attrs.get("volume_ratio", 0) > 2.0)

    # ── Category 5: Market Context ──────────────────────────────────────
    for ctx_ticker, prefix in [("SPY", "spy"), ("QQQ", "qqq"), ("IWM", "iwm")]:
        ctx_key = f"{ctx_ticker}_{start_str}_{end_str}"
        if ctx_key not in cache:
            cache[ctx_key] = _safe_download(ctx_ticker, start_str, end_str)
        ctx = cache[ctx_key]
        if not ctx.empty and len(ctx) >= 2:
            ctx = ctx[ctx.index.date <= entry_date]
            if len(ctx) >= 2:
                attrs[f"{prefix}_return_1d"] = (ctx["Close"].iloc[-1] - ctx["Close"].iloc[-2]) / ctx["Close"].iloc[-2]
                if len(ctx) >= 6:
                    attrs[f"{prefix}_return_5d"] = (ctx["Close"].iloc[-1] - ctx["Close"].iloc[-6]) / ctx["Close"].iloc[-6]

    vix_key = f"^VIX_{start_str}_{end_str}"
    if vix_key not in cache:
        cache[vix_key] = _safe_download("^VIX", start_str, end_str)
    vix = cache[vix_key]
    if not vix.empty:
        vix = vix[vix.index.date <= entry_date]
        if len(vix) >= 2:
            attrs["vix_level"] = vix["Close"].iloc[-1]
            attrs["vix_change_1d"] = vix["Close"].iloc[-1] - vix["Close"].iloc[-2]
            if len(vix) >= 30:
                attrs["vix_percentile_30d"] = (vix["Close"].iloc[-30:] < vix["Close"].iloc[-1]).mean()

    # Correlation with SPY
    spy_key = f"SPY_{start_str}_{end_str}"
    if spy_key in cache and not cache[spy_key].empty and len(close) >= 20:
        spy_close = cache[spy_key]
        spy_close = spy_close[spy_close.index.date <= entry_date]["Close"]
        if len(spy_close) >= 20:
            common_idx = close.index.intersection(spy_close.index)[-20:]
            if len(common_idx) >= 10:
                attrs["corr_spy_20d"] = close.loc[common_idx].pct_change().corr(spy_close.loc[common_idx].pct_change())

    # ── Category 6: Time Features ───────────────────────────────────────
    if hasattr(entry_time, "hour"):
        attrs["hour_of_day"] = entry_time.hour
        attrs["minute_of_hour"] = entry_time.minute
        attrs["is_pre_market"] = float(entry_time.hour < 9 or (entry_time.hour == 9 and entry_time.minute < 30))
        attrs["is_first_hour"] = float(entry_time.hour == 9 or (entry_time.hour == 10 and entry_time.minute <= 30))
        attrs["is_last_hour"] = float(entry_time.hour == 15)

    if hasattr(entry_date, "weekday"):
        attrs["day_of_week"] = entry_date.weekday() if hasattr(entry_date, "weekday") else entry_time.weekday()
        attrs["is_monday"] = float(attrs["day_of_week"] == 0)
        attrs["is_friday"] = float(attrs["day_of_week"] == 4)
        attrs["month"] = entry_date.month if hasattr(entry_date, "month") else entry_time.month
        attrs["quarter"] = (attrs["month"] - 1) // 3 + 1
        attrs["day_of_month"] = entry_date.day if hasattr(entry_date, "day") else entry_time.day

    # OPEX
    import calendar
    yr = entry_date.year if hasattr(entry_date, "year") else entry_time.year
    mo = entry_date.month if hasattr(entry_date, "month") else entry_time.month
    c = calendar.Calendar()
    fridays = [d for d in c.itermonthdays2(yr, mo) if d[0] != 0 and d[1] == 4]
    opex_day = fridays[2][0] if len(fridays) >= 3 else 20
    from datetime import date
    opex_date = date(yr, mo, opex_day)
    attrs["days_to_opex"] = (opex_date - entry_date).days if hasattr(entry_date, "year") else 0
    attrs["is_opex_week"] = float(abs(attrs["days_to_opex"]) <= 5)

    # ── Category 7: Sentiment & Events ────────────────────────────────
    # FinBERT sentiment on the original Discord message
    msg_text = row.get("raw_message", row.get("content", ""))
    if msg_text and isinstance(msg_text, str):
        try:
            from shared.nlp.sentiment_classifier import SentimentClassifier
            _clf = SentimentClassifier()
            sent = _clf.classify(msg_text)
            attrs["sentiment_score"] = sent.score
            attrs["sentiment_confidence"] = sent.confidence
            attrs["sentiment_numeric"] = sent.numeric
            attrs["sentiment_bullish"] = float(sent.is_bullish)
            attrs["sentiment_bearish"] = float(sent.is_bearish)
        except Exception:
            attrs["sentiment_score"] = np.nan
            attrs["sentiment_confidence"] = np.nan
            attrs["sentiment_numeric"] = np.nan
            attrs["sentiment_bullish"] = np.nan
            attrs["sentiment_bearish"] = np.nan

    # Earnings calendar (yfinance)
    try:
        import yfinance as yf
        yf_ticker = yf.Ticker(ticker)
        cal = yf_ticker.calendar
        if cal is not None:
            earn_date = None
            if isinstance(cal, dict):
                earn_date = cal.get("Earnings Date")
                if isinstance(earn_date, list) and earn_date:
                    earn_date = earn_date[0]
            elif isinstance(cal, pd.DataFrame) and "Earnings Date" in cal.index:
                earn_date = cal.loc["Earnings Date"].iloc[0]
            if earn_date:
                earn_dt = pd.Timestamp(earn_date).date()
                attrs["days_to_earnings"] = (earn_dt - entry_date).days
                attrs["earnings_within_7d"] = float(abs(attrs["days_to_earnings"]) <= 7)
                attrs["earnings_within_14d"] = float(abs(attrs["days_to_earnings"]) <= 14)
        # Analyst recommendations
        recs = yf_ticker.recommendations
        if recs is not None and not recs.empty:
            # Filter to recs before entry date for no look-ahead
            if hasattr(recs.index, 'date'):
                recs = recs[recs.index.date <= entry_date]
            recent = recs.tail(5)
            grade_map = {"Strong Buy": 5, "Buy": 4, "Overweight": 4,
                         "Hold": 3, "Neutral": 3, "Equal-Weight": 3,
                         "Underweight": 2, "Sell": 1, "Strong Sell": 0}
            grades = []
            for _, r in recent.iterrows():
                g = r.get("To Grade", r.get("toGrade", ""))
                if g in grade_map:
                    grades.append(grade_map[g])
            if grades:
                attrs["analyst_avg_grade"] = np.mean(grades)
                attrs["analyst_recent_upgrades"] = sum(1 for g in grades if g >= 4)
                attrs["analyst_recent_downgrades"] = sum(1 for g in grades if g <= 2)
    except Exception:
        pass

    # FOMC/CPI/NFP proximity
    fomc_dates = [
        "2024-01-31", "2024-03-20", "2024-05-01", "2024-06-12",
        "2024-07-31", "2024-09-18", "2024-11-07", "2024-12-18",
        "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
        "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17",
        "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
        "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
    ]
    cpi_dates = [
        "2024-01-11", "2024-02-13", "2024-03-12", "2024-04-10",
        "2024-05-15", "2024-06-12", "2024-07-11", "2024-08-14",
        "2024-09-11", "2024-10-10", "2024-11-13", "2024-12-11",
        "2025-01-15", "2025-02-12", "2025-03-12", "2025-04-10",
        "2025-05-13", "2025-06-11", "2025-07-15", "2025-08-12",
        "2025-09-10", "2025-10-14", "2025-11-12", "2025-12-10",
        "2026-01-14", "2026-02-11", "2026-03-11", "2026-04-10",
        "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12",
        "2026-09-11", "2026-10-13", "2026-11-10", "2026-12-10",
    ]
    from datetime import date as date_cls
    for name, dates in [("fomc", fomc_dates), ("cpi", cpi_dates)]:
        future = [d for d in (date_cls.fromisoformat(d) for d in dates) if d >= entry_date]
        if future:
            days_away = (future[0] - entry_date).days
            attrs[f"days_to_{name}"] = days_away
            attrs[f"{name}_within_3d"] = float(days_away <= 3)

    # ── Category 8: Options Data ──────────────────────────────────────
    try:
        import asyncio
        from shared.unusual_whales.client import UnusualWhalesClient
        uw = UnusualWhalesClient()
        _loop = asyncio.new_event_loop()
        # Options flow
        flow = _loop.run_until_complete(uw.get_options_flow(ticker=ticker))
        if flow:
            total_premium = sum(float(f.premium or 0) for f in flow[:50])
            call_premium = sum(float(f.premium or 0) for f in flow[:50]
                               if f.option_type == "CALL")
            put_premium = total_premium - call_premium
            attrs["options_total_premium_50"] = total_premium
            attrs["options_call_premium_pct"] = call_premium / total_premium if total_premium > 0 else 0.5
            attrs["options_put_call_ratio"] = put_premium / call_premium if call_premium > 0 else np.nan
            attrs["options_flow_count"] = len(flow)
        # GEX
        gex = _loop.run_until_complete(uw.get_gex(ticker))
        if gex and gex.total_gex is not None:
            attrs["gex_value"] = float(gex.total_gex)
            attrs["gex_positive"] = float(attrs.get("gex_value", 0) > 0)
        # IV rank & Greeks from options chain
        try:
            chain = _loop.run_until_complete(uw.get_option_chain(ticker))
            contracts = chain.contracts if chain else []
            if contracts:
                ivs = [c.implied_volatility for c in contracts if c.implied_volatility]
                if ivs:
                    current_iv = ivs[0]
                    iv_min, iv_max = min(ivs), max(ivs)
                    attrs["iv_current"] = current_iv
                    attrs["iv_rank"] = ((current_iv - iv_min) / (iv_max - iv_min)
                                        if iv_max > iv_min else 0.5)
                    attrs["iv_percentile"] = sum(1 for iv in ivs if iv <= current_iv) / len(ivs)
                # Average Greeks from near-the-money contracts
                entry_price = float(row.get("entry_price", 0))
                atm = [c for c in contracts if entry_price > 0 and
                       abs(c.strike - entry_price) < entry_price * 0.05]
                if not atm:
                    atm = contracts[:5]
                if atm:
                    attrs["avg_delta"] = np.mean([c.delta or 0 for c in atm])
                    attrs["avg_gamma"] = np.mean([c.gamma or 0 for c in atm])
                    attrs["avg_theta"] = np.mean([c.theta or 0 for c in atm])
                    attrs["avg_vega"] = np.mean([c.vega or 0 for c in atm])
        except Exception:
            pass
        _loop.run_until_complete(uw.close())
        _loop.close()
    except Exception:
        pass

    return attrs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    print(f"Enriching {len(df)} trades...")

    cache = {}
    enriched_rows = []

    for idx, row in df.iterrows():
        attrs = enrich_trade(row, cache)
        enriched_rows.append(attrs)

        if (idx + 1) % 50 == 0:
            print(f"  Enriched {idx + 1}/{len(df)} trades...")

    enriched_df = pd.DataFrame(enriched_rows)
    result = pd.concat([df.reset_index(drop=True), enriched_df], axis=1)

    n_new_cols = len(enriched_df.columns)
    print(f"Added {n_new_cols} market attributes")

    # --- Rolling analyst features ---
    if "analyst" in result.columns:
        result = result.sort_values("entry_time").reset_index(drop=True)
        for window in [10, 20]:
            grp = result.groupby("analyst")["is_profitable"]
            result[f"analyst_win_rate_{window}"] = grp.transform(
                lambda s: s.shift(1).rolling(window, min_periods=1).mean()
            )
        grp_pnl = result.groupby("analyst")["pnl_pct"] if "pnl_pct" in result.columns else None
        if grp_pnl is not None:
            result["analyst_avg_pnl_10"] = grp_pnl.transform(
                lambda s: s.shift(1).rolling(10, min_periods=1).mean()
            )

        def _streak(s):
            shifted = s.shift(1).fillna(0)
            streaks = []
            current = 0
            for v in shifted:
                current = current + 1 if v == 1 else 0
                streaks.append(current)
            return pd.Series(streaks, index=s.index)

        result["analyst_win_streak"] = result.groupby("analyst")["is_profitable"].transform(_streak)
        print("Added rolling analyst features")

    # --- Candle windows (30 bars x 15 features per trade) ---
    candle_windows = _build_candle_windows(result, cache)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if candle_windows is not None:
        candle_out = output_path.parent / "candle_windows.npy"
        np.save(candle_out, candle_windows)
        print(f"Saved candle windows: shape={candle_windows.shape} to {candle_out}")

    result.to_parquet(output_path, index=False)
    print(f"Saved enriched data to {output_path}")

    try:
        from report_to_phoenix import report_progress
        report_progress("enrich", f"Enriched {len(result)} trades with {n_new_cols} attributes", 30, {
            "trades": len(result),
            "attributes_added": n_new_cols,
        })
    except Exception:
        pass


def _build_candle_windows(df: pd.DataFrame, cache: dict) -> np.ndarray | None:
    """Build 30-bar x 15-feature candle windows for each trade."""
    BARS = 30
    FEATURES_PER_BAR = 15

    windows = []
    tickers = df["ticker"].values if "ticker" in df.columns else [None] * len(df)
    times = pd.to_datetime(df["entry_time"]) if "entry_time" in df.columns else [None] * len(df)

    for i in range(len(df)):
        ticker = tickers[i]
        entry_time = times[i] if times is not None else None

        if ticker is None or entry_time is None or pd.isna(entry_time):
            windows.append(np.zeros((BARS, FEATURES_PER_BAR), dtype=np.float32))
            continue

        cache_key = f"5m_{ticker}_{entry_time.date()}"
        if cache_key not in cache:
            start = (entry_time - timedelta(days=5)).strftime("%Y-%m-%d")
            end = (entry_time + timedelta(days=1)).strftime("%Y-%m-%d")
            try:
                import yfinance as yf
                hist = yf.download(ticker, start=start, end=end, interval="5m", progress=False)
                if isinstance(hist.columns, pd.MultiIndex):
                    hist.columns = hist.columns.get_level_values(0)
                cache[cache_key] = hist
            except Exception:
                cache[cache_key] = pd.DataFrame()

        hist = cache[cache_key]
        if hist.empty or len(hist) < BARS:
            windows.append(np.zeros((BARS, FEATURES_PER_BAR), dtype=np.float32))
            continue

        if hist.index.tz is not None:
            entry_tz = hist.index.tz
            if entry_time.tzinfo is None:
                entry_time = entry_time.tz_localize(entry_tz)
        mask = hist.index <= entry_time
        pre = hist[mask].tail(BARS)
        if len(pre) < BARS:
            windows.append(np.zeros((BARS, FEATURES_PER_BAR), dtype=np.float32))
            continue

        close = pre["Close"]
        high = pre["High"]
        low = pre["Low"]
        volume = pre["Volume"]

        rsi = _calc_rsi(close, 14).fillna(50)
        macd_line, macd_signal, _ = _calc_macd(close)
        ema9 = _calc_ema(close, 9)
        sma20 = _calc_sma(close, 20)
        atr = ((high - low).rolling(14).mean()).fillna(0)
        obv = (np.sign(close.diff().fillna(0)) * volume).cumsum()
        vwap = (close * volume).cumsum() / volume.cumsum().replace(0, np.nan)
        bb_upper = sma20 + 2 * close.rolling(20).std()
        bb_lower = sma20 - 2 * close.rolling(20).std()

        bar_data = np.column_stack([
            pre["Open"].values, high.values, low.values, close.values, volume.values,
            rsi.values, macd_line.values if hasattr(macd_line, "values") else np.zeros(BARS),
            macd_signal.values if hasattr(macd_signal, "values") else np.zeros(BARS),
            bb_upper.fillna(0).values, bb_lower.fillna(0).values,
            atr.values, obv.values, vwap.fillna(0).values, ema9.fillna(0).values, sma20.fillna(0).values,
        ])

        if bar_data.shape != (BARS, FEATURES_PER_BAR):
            windows.append(np.zeros((BARS, FEATURES_PER_BAR), dtype=np.float32))
        else:
            col_max = np.abs(bar_data).max(axis=0)
            col_max[col_max == 0] = 1
            windows.append((bar_data / col_max).astype(np.float32))

    return np.array(windows, dtype=np.float32)


if __name__ == "__main__":
    main()
