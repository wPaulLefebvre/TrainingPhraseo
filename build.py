#!/usr/bin/env python3
"""Assemble l'app en un seul fichier HTML autonome : dist/phraseo-radio.html.

Ce fichier est celui qu'on publie comme artefact sur claude.ai (correction par Claude
sur l'abonnement). La version GitHub Pages utilise directement index.html et js/.
Usage : python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
ORDER = ['aerodromes', 'radio', 'scenarios', 'storage', 'speech', 'evaluator', 'app']

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')

js_parts = []
for name in ORDER:
    src = (ROOT / f'js/{name}.js').read_text(encoding='utf-8')
    src = re.sub(r"^import[\s\S]*?from\s+'[^']+';\s*$", '', src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    js_parts.append(f'// ===== {name}.js =====\n{src}')
js = '\n'.join(js_parts)

# Liens propres à l'installation GitHub (manifest, icônes) : inutiles dans un artefact
html = re.sub(r'\s*<link rel="(manifest|apple-touch-icon|icon)"[^>]*>', '', html)
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')
html = html.replace('<script type="module" src="js/app.js"></script>', f'<script type="module">\n{js}\n</script>')

out = ROOT / 'dist' / 'phraseo-radio.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'OK : {out} ({out.stat().st_size // 1024} Ko)')
