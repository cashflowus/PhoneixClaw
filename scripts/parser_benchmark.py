#!/usr/bin/env python3
"""
Parser benchmark: run regex (and optionally BERT) on curated test set.

Reports precision/recall per field. Exits with non-zero if regression below threshold.

Usage:
  python3 scripts/parser_benchmark.py
  python3 scripts/parser_benchmark.py --min-precision 0.85
  python3 scripts/parser_benchmark.py --include-bert  # requires nlp-parser deps
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.trade_parser.src.parser import parse_trade_message


def load_test_cases() -> list[dict]:
    path = Path(__file__).resolve().parents[1] / "data" / "parser_test_cases.json"
    if not path.exists():
        print(f"Error: {path} not found")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def _get_first_action(parsed: dict) -> dict | None:
    actions = parsed.get("actions", [])
    return actions[0] if actions else None


def _field_match(expected: dict, actual: dict, field: str) -> bool:
    exp_val = expected.get(field)
    act_val = actual.get(field)
    if exp_val is None and act_val is None:
        return True
    if exp_val is None or act_val is None:
        return False
    # Numeric tolerance
    if isinstance(exp_val, (int, float)) and isinstance(act_val, (int, float)):
        return abs(float(exp_val) - float(act_val)) < 0.01
    return str(exp_val).upper() == str(act_val).upper()


def evaluate_regex(cases: list[dict]) -> dict[str, float]:
    """Evaluate regex parser on test cases. Returns precision/recall per field."""
    fields = ["action", "ticker", "strike", "option_type", "price", "quantity"]
    tp = {f: 0 for f in fields}
    fp = {f: 0 for f in fields}
    fn = {f: 0 for f in fields}

    for tc in cases:
        inp = tc["input"]
        expected_actions = tc["expected"].get("actions", [])
        parsed = parse_trade_message(inp)
        actual_actions = parsed.get("actions", [])

        exp_first = expected_actions[0] if expected_actions else None
        act_first = actual_actions[0] if actual_actions else None

        for field in fields:
            exp_has = exp_first is not None and exp_first.get(field) is not None
            act_has = act_first is not None and act_first.get(field) is not None

            if exp_has and act_has:
                if _field_match(exp_first, act_first, field):
                    tp[field] += 1
                else:
                    fp[field] += 1
                    fn[field] += 1
            elif exp_has and not act_has:
                fn[field] += 1
            elif not exp_has and act_has:
                fp[field] += 1

    results = {}
    for f in fields:
        p = tp[f] / (tp[f] + fp[f]) if (tp[f] + fp[f]) > 0 else 1.0
        r = tp[f] / (tp[f] + fn[f]) if (tp[f] + fn[f]) > 0 else 1.0
        results[f] = {"precision": p, "recall": r}
    return results


def run_benchmark(include_bert: bool = False, min_precision: float = 0.80) -> bool:
    """Run benchmark. Returns True if passed."""
    cases = load_test_cases()
    print(f"Loaded {len(cases)} test cases from data/parser_test_cases.json")
    print()

    # Regex parser
    print("=== Regex Parser ===")
    results = evaluate_regex(cases)
    all_ok = True
    for field, metrics in results.items():
        p, r = metrics["precision"], metrics["recall"]
        status = "OK" if p >= min_precision and r >= min_precision else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(f"  {field:12} P={p:.2%} R={r:.2%}  {status}")

    overall_p = sum(m["precision"] for m in results.values()) / len(results)
    overall_r = sum(m["recall"] for m in results.values()) / len(results)
    print(f"  {'overall':12} P={overall_p:.2%} R={overall_r:.2%}")
    print()

    if include_bert:
        print("=== BERT/NLP Parser (optional) ===")
        try:
            nlp_path = Path(__file__).resolve().parents[1] / "services" / "nlp-parser"
            sys.path.insert(0, str(nlp_path))
            from src.bert_entity_extractor import extract_entities_bert
            from src.entity_extractor import extract_entities

            for tc in cases[:3]:
                inp = tc["input"]
                bert = extract_entities_bert(inp)
                spacy_result = extract_entities(inp)
                print(f"  Input: {inp[:50]}...")
                print(f"    BERT: {bert}")
                print(f"    spaCy: {spacy_result}")
        except ImportError as e:
            print(f"  Skipped (nlp-parser not available): {e}")
        print()

    return all_ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-precision", type=float, default=0.80, help="Min precision/recall to pass")
    ap.add_argument("--include-bert", action="store_true", help="Also run BERT extractor on sample")
    args = ap.parse_args()

    passed = run_benchmark(include_bert=args.include_bert, min_precision=args.min_precision)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
