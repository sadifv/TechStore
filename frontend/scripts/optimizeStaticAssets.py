"""Offline asset conversion. Requires fonttools[woff] and Pillow; never runs in the app/build."""

import argparse
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manrope', type=Path, required=True)
    parser.add_argument('--icons', type=Path, required=True)
    parser.add_argument('--laptop', type=Path, required=True)
    args = parser.parse_args()
    public = Path(__file__).resolve().parents[1] / 'public'

    # Preserve every Manrope character and the complete variable weight range.
    font = TTFont(args.manrope)
    font.flavor = 'woff2'
    font.save(public / 'fonts/manrope-variable.woff2')

    css = (public / 'css/remixicon.css').read_text(encoding='utf-8')
    codepoints = {int(value, 16) for value in re.findall(r'content:\s*"\\([0-9a-f]+)"', css)}
    if not codepoints:
        raise ValueError('No icon codepoints found; refusing to generate an empty font.')
    icons = TTFont(args.icons)
    missing = codepoints - set(icons.getBestCmap())
    if missing:
        raise ValueError(f'The source font is missing icons: {missing}')
    options = subset.Options()
    options.flavor = 'woff2'
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(icons)
    icons.flavor = 'woff2'
    icons.save(public / 'fonts/remixicon.woff2')

    with Image.open(args.laptop) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        for width in (480, 768, 960):
            height = round(image.height * width / image.width)
            image.resize((width, height), Image.Resampling.LANCZOS).save(
                public / f'images/products/dell-xps-reference-{width}.webp',
                format='WEBP', quality=80, method=6,
            )


if __name__ == '__main__':
    main()
