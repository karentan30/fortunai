#!/usr/bin/env python3
import re
import os

# Hex色码 → 颜色描述映射
HEX_MAP = {
    '#6b3fa0': 'deep amethyst purple',
    '#faf8f5': 'warm white',
    '#5bbfa0': 'jade green',
    '#c9a84c': 'antique gold',
    '#0d0a18': 'deep midnight blue',
    '#f4b8c1': 'soft ballet pink',
    '#f0a8b5': 'dusty rose pink',
    '#c87b8a': 'deep rose',
    '#0a0a0a': 'jet black',
    '#7b52ab': 'deep violet',
    '#b8a8c0': 'lavender grey',
    '#f8fbff': 'ice clear',
}

def fix_hex_colors(text):
    """Remove Hex color codes and keep color descriptions only"""
    for hex_code, color_desc in HEX_MAP.items():
        # Pattern: color name followed by hex code
        pattern = rf'({color_desc})[,\s]+\({hex_code}\)'
        replacement = color_desc
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text

def fix_1girl_contradiction(text):
    """Fix '1girl, beautiful face' but 'no faces in frame' contradictions"""
    # If has "1girl, beautiful realistic face" and "no faces", remove face description
    if re.search(r'1girl.*beautiful.*face', text, re.IGNORECASE) and re.search(r'no faces|face-free', text, re.IGNORECASE):
        text = re.sub(r',\s*beautiful realistic face,\s*perfect skin,', ',', text)
    return text

def fix_size_focal_mismatch(text):
    """Fix竖版尺寸与焦距不匹配"""
    # 832x1216竖版 + 24mm wide = 问题，改为50mm
    if '832x1216' in text and '24mm' in text:
        text = text.replace('24mm wide angle', '50mm portrait')
    return text

def add_light_source(text):
    """Add light source description if missing"""
    if 'volumetric fog' in text and 'light source' not in text.lower():
        text = text.replace('volumetric fog', 'single light source, volumetric fog')
    return text

def process_file(filepath):
    """Process a single copy-*.md file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_len = len(content)

    # Apply all fixes
    content = fix_hex_colors(content)
    content = fix_1girl_contradiction(content)
    content = fix_size_focal_mismatch(content)
    content = add_light_source(content)

    # Write back if changed
    if len(content) != original_len:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ {os.path.basename(filepath)} — fixed")
        return True
    else:
        print(f"⚠️ {os.path.basename(filepath)} — no changes")
        return False

# Main
docs_dir = '/Users/karen/projects/shenyuan/docs/marketing/'
fixed_count = 0

for filename in sorted(os.listdir(docs_dir)):
    if filename.startswith('copy-') and filename.endswith('.md'):
        filepath = os.path.join(docs_dir, filename)
        if process_file(filepath):
            fixed_count += 1

print(f"\n📊 总计修复: {fixed_count}/10 个文件")
