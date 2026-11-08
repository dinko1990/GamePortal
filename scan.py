#!/usr/bin/env python3
"""Scans ./games for .html files and writes games.json and games.js. Run after adding a game."""
import json, pathlib
root = pathlib.Path(__file__).parent
files = sorted(p.name for p in (root / "games").glob("*.html"))
(root / "games.json").write_text(json.dumps(files, indent=2))
# games.js is loaded with a <script> tag, so it also works when index.html is opened straight from disk (file://)
(root / "games.js").write_text("window.GAMES = " + json.dumps(files) + ";\n")
print(f"Found {len(files)} games:", *files, sep="\n  ")
