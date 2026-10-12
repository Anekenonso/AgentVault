import zlib
import struct
import os

def create_png(width, height, rgba_data):
    # rgba_data is a list of rows, where each row is a bytearray of RGBA bytes (width * 4 bytes)
    raw_data = bytearray()
    for row in rgba_data:
        raw_data.append(0)  # filter type None
        raw_data.extend(row)
    
    compressed = zlib.compress(bytes(raw_data), 9)
    
    def make_chunk(chunk_type, data):
        length = len(data)
        chunk = struct.pack('>I', length) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        chunk += struct.pack('>I', crc)
        return chunk
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(make_chunk(b'IHDR', ihdr))
    # IDAT
    png.extend(make_chunk(b'IDAT', compressed))
    # IEND
    png.extend(make_chunk(b'IEND', b''))
    return bytes(png)

def create_ico(png_32, png_16=None):
    # ICO header: reserved(2), type(2=1), count(2)
    images = [png_32]
    if png_16:
        images.append(png_16)
    
    count = len(images)
    header = struct.pack('<HHH', 0, 1, count)
    
    # Directory entries (16 bytes each)
    offset = 6 + 16 * count
    entries = bytearray()
    for img in images:
        # read width and height from PNG IHDR (offset 16 is width, 20 is height)
        w = struct.unpack('>I', img[16:20])[0]
        h = struct.unpack('>I', img[20:24])[0]
        w_byte = 0 if w >= 256 else w
        h_byte = 0 if h >= 256 else h
        size = len(img)
        entry = struct.pack('<BBBBHHII', w_byte, h_byte, 0, 0, 1, 32, size, offset)
        entries.extend(entry)
        offset += size
    
    ico = bytearray(header)
    ico.extend(entries)
    for img in images:
        ico.extend(img)
    return bytes(ico)

# Colors
C_BG = (250, 246, 239, 255)        # #faf6ef
C_BORDER = (230, 220, 203, 255)    # #e6dccb
C_SPRUCE = (31, 77, 58, 255)       # #1f4d3a
C_SPRUCE_DARK = (22, 56, 40, 255)  # #163828
C_SAGE = (223, 234, 227, 255)      # #dfeae3
C_TERRACOTTA = (194, 81, 47, 255)  # #c2512f

def render_icon_pixels(size):
    # Renders a pristine ExceptionLineage shield icon
    rows = []
    scale = size / 32.0
    for y in range(size):
        row = bytearray()
        for x in range(size):
            # Normalize to 32x32 space
            nx = x / scale
            ny = y / scale
            
            # Rounded rect background (radius 6)
            is_inside_card = True
            r = 5.0
            if nx < r and ny < r:
                if (nx - r)**2 + (ny - r)**2 > r**2: is_inside_card = False
            elif nx > (31 - r) and ny < r:
                if (nx - (31 - r))**2 + (ny - r)**2 > r**2: is_inside_card = False
            elif nx < r and ny > (31 - r):
                if (nx - r)**2 + (ny - (31 - r))**2 > r**2: is_inside_card = False
            elif nx > (31 - r) and ny > (31 - r):
                if (nx - (31 - r))**2 + (ny - (31 - r))**2 > r**2: is_inside_card = False
            
            if not is_inside_card:
                row.extend([0, 0, 0, 0])
                continue
            
            # Border edge
            is_border = (x == 0 or x == size - 1 or y == 0 or y == size - 1)
            
            # Shield geometry centered at x=15.5
            # Shield top: y=5, x from 10 to 21
            # Shield upper body: y=5 to y=17, x from 7 to 24
            # Shield lower taper: y=17 to 27, converging to x=15.5
            dx = abs(nx - 15.5)
            in_shield = False
            in_inner = False
            in_core = False
            in_latch = False
            
            if 5 <= ny <= 16:
                if dx <= 8.5:
                    in_shield = True
            elif 16 < ny <= 26:
                # taper from width 8.5 at 16 down to 0 at 26
                allowed_dx = 8.5 * (1.0 - (ny - 16) / 10.5)
                if dx <= allowed_dx:
                    in_shield = True
            
            # Inner facet
            if in_shield:
                if 8 <= ny <= 15 and dx <= 5.5:
                    in_inner = True
                elif 15 < ny <= 23:
                    allowed_inner_dx = 5.5 * (1.0 - (ny - 15) / 8.5)
                    if dx <= allowed_inner_dx:
                        in_inner = True
            
            # Core diamond at center (y=12 to y=16)
            if 10.5 <= ny <= 15.5:
                core_dx = abs(nx - 15.5)
                core_dy = abs(ny - 13.0)
                if core_dx + core_dy <= 2.8:
                    in_core = True
            
            # Latch dot/stem at bottom of shield
            if 18 <= ny <= 22 and dx <= 1.0:
                in_latch = True
            elif (nx - 15.5)**2 + (ny - 22.5)**2 <= 1.8**2:
                in_latch = True
            
            if in_latch:
                row.extend(C_TERRACOTTA)
            elif in_core:
                row.extend(C_SAGE)
            elif in_inner:
                row.extend(C_SPRUCE_DARK)
            elif in_shield:
                row.extend(C_SPRUCE)
            elif is_border:
                row.extend(C_BORDER)
            else:
                row.extend(C_BG)
        rows.append(row)
    return rows

png_64 = create_png(64, 64, render_icon_pixels(64))
png_32 = create_png(32, 32, render_icon_pixels(32))
png_16 = create_png(16, 16, render_icon_pixels(16))
ico_data = create_ico(png_32, png_16)

# Write to public
os.makedirs("apps/web/public", exist_ok=True)
with open("apps/web/public/favicon.ico", "wb") as f:
    f.write(ico_data)
with open("apps/web/public/favicon-32x32.png", "wb") as f:
    f.write(png_32)
with open("apps/web/public/favicon-16x16.png", "wb") as f:
    f.write(png_16)
with open("apps/web/public/apple-touch-icon.png", "wb") as f:
    f.write(png_64)

# Also write favicon.ico to apps/web/src/app for Next.js App Router root handling
os.makedirs("apps/web/src/app", exist_ok=True)
with open("apps/web/src/app/favicon.ico", "wb") as f:
    f.write(ico_data)

print("Favicon files generated successfully!")
