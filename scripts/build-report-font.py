"""Merge the licensed Cairo Latin and Arabic webfont subsets for PDF export."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.merge import Merger

root = Path(__file__).resolve().parents[1]
source = root / 'node_modules' / '@fontsource' / 'cairo' / 'files'
target = root / 'assets' / 'fonts'
target.mkdir(parents=True, exist_ok=True)
parts = []
for subset in ('latin', 'arabic'):
    font = TTFont(source / f'cairo-{subset}-400-normal.woff')
    font.flavor = None
    filename = target / f'cairo-{subset}.ttf'
    font.save(filename)
    parts.append(filename)
merged = Merger().merge([str(part) for part in parts])
merged.flavor = None
merged.save(target / 'cairo-report.ttf')
for part in parts:
    part.unlink()
