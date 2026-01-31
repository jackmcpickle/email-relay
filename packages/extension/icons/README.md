# Extension Icons

PNG icons required for the extension. Generate from SVGs or create manually.

Required sizes:
- icon-16.png (16x16)
- icon-48.png (48x48)  
- icon-128.png (128x128)

SVG source files are provided. To convert:

```bash
# Using Inkscape
inkscape -w 16 -h 16 icon-16.svg -o icon-16.png
inkscape -w 48 -h 48 icon-48.svg -o icon-48.png
inkscape -w 128 -h 128 icon-128.svg -o icon-128.png

# Or using ImageMagick
convert -background none icon-16.svg icon-16.png
convert -background none icon-48.svg icon-48.png
convert -background none icon-128.svg icon-128.png
```

For quick testing, you can use any 16x16, 48x48, and 128x128 PNG files.
