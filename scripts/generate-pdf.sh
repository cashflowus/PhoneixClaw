#!/bin/bash
# Regenerate PHOENIX_TRADE_BOT_EXPLAINED.pdf from the Markdown source.
# Requires one of: pandoc+pdflatex, md-to-pdf (npm), or weasyprint.

set -e
cd "$(dirname "$0")/.."
MD="PHOENIX_TRADE_BOT_EXPLAINED.md"
PDF="PHOENIX_TRADE_BOT_EXPLAINED.pdf"

if command -v pandoc &>/dev/null; then
  if pandoc "$MD" -o "$PDF" --pdf-engine=pdflatex -V geometry:margin=1in 2>/dev/null; then
    echo "Generated $PDF via pandoc+pdflatex"
    exit 0
  fi
  if pandoc "$MD" -o "$PDF" --pdf-engine=weasyprint 2>/dev/null; then
    echo "Generated $PDF via pandoc+weasyprint"
    exit 0
  fi
fi

if command -v npx &>/dev/null; then
  if npx --yes md-to-pdf "$MD" 2>/dev/null; then
    echo "Generated $PDF via md-to-pdf"
    exit 0
  fi
fi

echo "Could not generate PDF. Install one of:"
echo "  - pandoc + pdflatex (brew install pandoc basictex)"
echo "  - npx md-to-pdf (npm package)"
echo "  - pandoc + weasyprint (pip install weasyprint)"
exit 1
