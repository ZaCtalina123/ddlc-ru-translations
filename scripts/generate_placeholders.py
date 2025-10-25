#!/usr/bin/env python3
"""
DDLC Placeholder Image Generator
Generates placeholder images in the website's color scheme
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import random
from typing import Tuple, List

# ==================== COLOR PALETTE ====================
COLORS = {
    'bg': '#0b0d10',           # Dark background
    'bg_elev': '#0f1318',      # Elevated background
    'accent': '#00e5ff',       # Cyan
    'accent_2': '#ff2bd6',     # Magenta/Pink
    'fg': '#e7f7ff',           # Light cyan
    'text_muted': '#94a3b8',   # Muted text
    'border': 'rgba(157, 255, 239, 0.22)',  # Border color
}

# Convert hex to RGB
def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

# ==================== PLACEHOLDER GENERATORS ====================

def generate_gradient_placeholder(
    width: int = 280,
    height: int = 200,
    style: str = 'diagonal'
) -> Image.Image:
    """Generate a gradient placeholder with cyberpunk aesthetic"""
    
    # Create image
    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['bg']))
    pixels = img.load()
    
    # Color palette for gradients
    color1 = hex_to_rgb(COLORS['accent'])      # Cyan
    color2 = hex_to_rgb(COLORS['accent_2'])    # Magenta
    bg = hex_to_rgb(COLORS['bg'])
    
    if style == 'diagonal':
        # Diagonal gradient from top-left to bottom-right
        for y in range(height):
            for x in range(width):
                ratio = (x + y) / (width + height)
                r = int(bg[0] + (color1[0] - bg[0]) * ratio * 0.5)
                g = int(bg[1] + (color1[1] - bg[1]) * ratio * 0.5)
                b = int(bg[2] + (color1[2] - bg[2]) * ratio * 0.5)
                pixels[x, y] = (r, g, b)
    
    elif style == 'radial':
        # Radial gradient from center
        center_x, center_y = width // 2, height // 2
        max_dist = ((width/2)**2 + (height/2)**2) ** 0.5
        
        for y in range(height):
            for x in range(width):
                dist = ((x - center_x)**2 + (y - center_y)**2) ** 0.5
                ratio = min(dist / max_dist, 1.0)
                
                # Alternate between colors
                if int(ratio * 10) % 2 == 0:
                    base_color = color1
                else:
                    base_color = color2
                
                r = int(bg[0] + (base_color[0] - bg[0]) * (1 - ratio))
                g = int(bg[1] + (base_color[1] - bg[1]) * (1 - ratio))
                b = int(bg[2] + (base_color[2] - bg[2]) * (1 - ratio))
                pixels[x, y] = (r, g, b)
    
    elif style == 'vertical':
        # Vertical gradient
        for y in range(height):
            ratio = y / height
            r = int(bg[0] + (color1[0] - bg[0]) * ratio)
            g = int(bg[1] + (color1[1] - bg[1]) * ratio)
            b = int(bg[2] + (color1[2] - bg[2]) * ratio)
            for x in range(width):
                pixels[x, y] = (r, g, b)
    
    elif style == 'horizontal':
        # Horizontal gradient
        for x in range(width):
            ratio = x / width
            r = int(bg[0] + (color2[0] - bg[0]) * ratio)
            g = int(bg[1] + (color2[1] - bg[1]) * ratio)
            b = int(bg[2] + (color2[2] - bg[2]) * ratio)
            for y in range(height):
                pixels[x, y] = (r, g, b)
    
    return img

def generate_geometric_placeholder(
    width: int = 280,
    height: int = 200,
    pattern: str = 'grid'
) -> Image.Image:
    """Generate geometric pattern placeholder"""
    
    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['bg']))
    draw = ImageDraw.Draw(img, 'RGBA')
    
    accent = hex_to_rgb(COLORS['accent'])
    accent_2 = hex_to_rgb(COLORS['accent_2'])
    
    if pattern == 'grid':
        cell_size = 40
        for x in range(0, width, cell_size):
            for y in range(0, height, cell_size):
                if (x // cell_size + y // cell_size) % 2 == 0:
                    color = accent + (30,)  # Add alpha
                else:
                    color = accent_2 + (20,)
                draw.rectangle([x, y, x + cell_size, y + cell_size], fill=color)
    
    elif pattern == 'lines':
        line_spacing = 20
        for i in range(0, width + height, line_spacing):
            draw.line([(i, 0), (i - height, height)], fill=accent + (40,), width=2)
            draw.line([(0, i), (width, i - width)], fill=accent_2 + (30,), width=2)
    
    elif pattern == 'circles':
        circle_size = 30
        for x in range(0, width, circle_size * 2):
            for y in range(0, height, circle_size * 2):
                color = accent if (x + y) % (circle_size * 4) == 0 else accent_2
                draw.ellipse(
                    [x, y, x + circle_size, y + circle_size],
                    fill=color + (50,)
                )
    
    elif pattern == 'waves':
        for x in range(width):
            y_offset = int(20 * (1 + 0.5 * (x / width)))
            draw.line(
                [(x, y_offset), (x, height)],
                fill=accent + (int(100 * (1 - x / width)),),
                width=1
            )
    
    return img

def generate_text_placeholder(
    width: int = 280,
    height: int = 200,
    text: str = 'PLACEHOLDER'
) -> Image.Image:
    """Generate placeholder with text"""
    
    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['bg']))
    draw = ImageDraw.Draw(img)
    
    # Try to use a nice font, fallback to default
    try:
        font_size = int(height * 0.15)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()
    
    # Draw text in center
    text_color = hex_to_rgb(COLORS['accent'])
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Add border
    border_color = hex_to_rgb(COLORS['accent_2'])
    draw.rectangle([0, 0, width - 1, height - 1], outline=border_color, width=2)
    
    return img

def generate_glitch_placeholder(
    width: int = 280,
    height: int = 200
) -> Image.Image:
    """Generate glitch art style placeholder"""
    
    img = Image.new('RGB', (width, height), hex_to_rgb(COLORS['bg']))
    draw = ImageDraw.Draw(img, 'RGBA')
    
    accent = hex_to_rgb(COLORS['accent'])
    accent_2 = hex_to_rgb(COLORS['accent_2'])
    
    # Draw random glitch rectangles
    for _ in range(random.randint(5, 15)):
        x1 = random.randint(0, width - 50)
        y1 = random.randint(0, height - 20)
        x2 = x1 + random.randint(30, 100)
        y2 = y1 + random.randint(10, 40)
        
        color = accent if random.random() > 0.5 else accent_2
        draw.rectangle([x1, y1, x2, y2], fill=color + (60,))
    
    # Add scanlines
    for y in range(0, height, 3):
        draw.line([(0, y), (width, y)], fill=(255, 255, 255, 10), width=1)
    
    return img

# ==================== MAIN GENERATOR ====================

def generate_placeholders(
    output_dir: str = 'assets',
    sizes: List[Tuple[int, int]] = None,
    count: int = 5
) -> None:
    """Generate multiple placeholder images"""
    
    if sizes is None:
        sizes = [
            (280, 200),   # Card image size
            (400, 300),   # Large
            (600, 400),   # Extra large
            (1200, 800),  # Hero
        ]
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    styles = ['gradient', 'geometric', 'glitch']
    patterns = ['diagonal', 'radial', 'vertical', 'horizontal', 'grid', 'lines', 'circles', 'waves']
    
    print(f"🎨 Generating placeholders in {output_dir}/")
    print(f"📐 Sizes: {sizes}")
    print(f"🎭 Styles: {styles}")
    print()
    
    generated = 0
    
    for size_idx, (width, height) in enumerate(sizes, 1):
        print(f"📏 Size {size_idx}/{len(sizes)}: {width}x{height}")
        
        # Gradient placeholders
        for style_idx, style in enumerate(['diagonal', 'radial', 'vertical', 'horizontal'], 1):
            img = generate_gradient_placeholder(width, height, style)
            filename = f"placeholder-{width}x{height}-gradient-{style}.png"
            filepath = output_path / filename
            img.save(filepath, 'PNG', optimize=True)
            print(f"  ✓ {filename}")
            generated += 1
        
        # Geometric placeholders
        for pattern_idx, pattern in enumerate(['grid', 'lines', 'circles', 'waves'], 1):
            img = generate_geometric_placeholder(width, height, pattern)
            filename = f"placeholder-{width}x{height}-geometric-{pattern}.png"
            filepath = output_path / filename
            img.save(filepath, 'PNG', optimize=True)
            print(f"  ✓ {filename}")
            generated += 1
        
        # Glitch placeholder
        img = generate_glitch_placeholder(width, height)
        filename = f"placeholder-{width}x{height}-glitch.png"
        filepath = output_path / filename
        img.save(filepath, 'PNG', optimize=True)
        print(f"  ✓ {filename}")
        generated += 1
        
        # Text placeholder
        img = generate_text_placeholder(width, height, f"{width}×{height}")
        filename = f"placeholder-{width}x{height}-text.png"
        filepath = output_path / filename
        img.save(filepath, 'PNG', optimize=True)
        print(f"  ✓ {filename}")
        generated += 1
        
        print()
    
    print(f"✅ Generated {generated} placeholder images!")
    print(f"📁 Saved to: {output_path.absolute()}")

def generate_single_placeholder(
    width: int = 280,
    height: int = 200,
    style: str = 'gradient',
    pattern: str = 'diagonal',
    output_dir: str = 'assets',
    filename: str = None
) -> str:
    """Generate a single placeholder image"""
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if style == 'gradient':
        img = generate_gradient_placeholder(width, height, pattern)
    elif style == 'geometric':
        img = generate_geometric_placeholder(width, height, pattern)
    elif style == 'glitch':
        img = generate_glitch_placeholder(width, height)
    elif style == 'text':
        img = generate_text_placeholder(width, height, pattern)
    else:
        raise ValueError(f"Unknown style: {style}")
    
    if filename is None:
        filename = f"placeholder-{width}x{height}-{style}-{pattern}.png"
    
    filepath = output_path / filename
    img.save(filepath, 'PNG', optimize=True)
    
    print(f"✅ Generated: {filepath}")
    return str(filepath)

# ==================== CLI ====================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate DDLC-themed placeholder images'
    )
    parser.add_argument(
        '--output',
        default='assets',
        help='Output directory (default: assets)'
    )
    parser.add_argument(
        '--width',
        type=int,
        default=280,
        help='Image width (default: 280)'
    )
    parser.add_argument(
        '--height',
        type=int,
        default=200,
        help='Image height (default: 200)'
    )
    parser.add_argument(
        '--style',
        choices=['gradient', 'geometric', 'glitch', 'text'],
        default='gradient',
        help='Placeholder style (default: gradient)'
    )
    parser.add_argument(
        '--pattern',
        default='diagonal',
        help='Pattern/style variant'
    )
    parser.add_argument(
        '--batch',
        action='store_true',
        help='Generate batch of all styles and sizes'
    )
    parser.add_argument(
        '--filename',
        help='Custom output filename'
    )
    
    args = parser.parse_args()
    
    if args.batch:
        generate_placeholders(args.output)
    else:
        generate_single_placeholder(
            width=args.width,
            height=args.height,
            style=args.style,
            pattern=args.pattern,
            output_dir=args.output,
            filename=args.filename
        )