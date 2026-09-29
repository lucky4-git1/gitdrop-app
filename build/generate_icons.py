import os
from PIL import Image, ImageDraw

def generate_icons():
    # Base SVG viewBox is 48x48
    # Use high-resolution canvas: 1024x1024 (scale factor = 1024 / 48)
    base_dim = 1024
    s = base_dim / 48.0
    
    img = Image.new('RGBA', (base_dim, base_dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Background rounded rectangle
    rx = 10.0 * s
    draw.rounded_rectangle([0, 0, base_dim, base_dim], radius=rx, fill="#0d1117")
    
    # Line width for branch connecting lines
    line_w = int(round(2.5 * s))
    half_lw = line_w / 2.0
    
    # 2. Branch connection paths (behind circles)
    # Vertical line from (16, 18.5) to (16, 29.5)
    p_v_start = (16.0 * s, 18.5 * s)
    p_v_end = (16.0 * s, 29.5 * s)
    draw.line([p_v_start, p_v_end], fill="#8b949e", width=line_w)
    draw.ellipse([p_v_start[0] - half_lw, p_v_start[1] - half_lw, p_v_start[0] + half_lw, p_v_start[1] + half_lw], fill="#8b949e")
    draw.ellipse([p_v_end[0] - half_lw, p_v_end[1] - half_lw, p_v_end[0] + half_lw, p_v_end[1] + half_lw], fill="#8b949e")
    
    # Cubic bezier curve: M 16 20 C 16 24, 24 24, 32 24
    p0 = (16.0 * s, 20.0 * s)
    p1 = (16.0 * s, 24.0 * s)
    p2 = (24.0 * s, 24.0 * s)
    p3 = (32.0 * s, 24.0 * s)
    
    bezier_points = []
    num_steps = 200
    for i in range(num_steps + 1):
        t = i / float(num_steps)
        t_inv = 1.0 - t
        bx = (t_inv**3 * p0[0] +
              3 * (t_inv**2) * t * p1[0] +
              3 * t_inv * (t**2) * p2[0] +
              t**3 * p3[0])
        by = (t_inv**3 * p0[1] +
              3 * (t_inv**2) * t * p1[1] +
              3 * t_inv * (t**2) * p2[1] +
              t**3 * p3[1])
        bezier_points.append((bx, by))
    
    draw.line(bezier_points, fill="#8b949e", width=line_w)
    draw.ellipse([p0[0] - half_lw, p0[1] - half_lw, p0[0] + half_lw, p0[1] + half_lw], fill="#8b949e")
    draw.ellipse([p3[0] - half_lw, p3[1] - half_lw, p3[0] + half_lw, p3[1] + half_lw], fill="#8b949e")
    
    # 3. Branch circles
    # circle radius = 4.5 * s, stroke_width = 2.0 * s
    r = 4.5 * s
    stroke_w = int(round(2.0 * s))
    
    nodes = [
        {"cx": 16.0 * s, "cy": 14.0 * s, "fill": "#388bfd", "stroke": "#58a6ff"},
        {"cx": 32.0 * s, "cy": 24.0 * s, "fill": "#3fb950", "stroke": "#56d364"},
        {"cx": 16.0 * s, "cy": 34.0 * s, "fill": "#a371f7", "stroke": "#bc8cff"},
    ]
    
    for node in nodes:
        cx = node["cx"]
        cy = node["cy"]
        # Outer stroke
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=node["fill"], outline=node["stroke"], width=stroke_w)
        
    out_dir = "d:/gitdropapp-source/build"
    os.makedirs(out_dir, exist_ok=True)
    
    # Downsample to 512x512 master with Lanczos filter for crisp antialiasing
    icon_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(out_dir, "icon.png"), "PNG")
    print("Saved build/icon.png (512x512)")
    
    # Create multi-size ICO file for Windows
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_512.save(os.path.join(out_dir, "icon.ico"), format="ICO", sizes=ico_sizes)
    print("Saved build/icon.ico with sizes:", ico_sizes)
    
    # Create Linux icons directory
    linux_icons_dir = os.path.join(out_dir, "icons")
    os.makedirs(linux_icons_dir, exist_ok=True)
    for sz in [16, 32, 48, 64, 128, 256, 512]:
        resized = icon_512.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(linux_icons_dir, f"{sz}x{sz}.png"), "PNG")
    print("Saved Linux icons in build/icons/")

if __name__ == "__main__":
    generate_icons()
