from PIL import Image

img = Image.open('public/Copy_of_Lumen_Academy_Logo_transparent.png').convert('RGBA')
pixels = img.load()

width, height = img.size

dark_pixels = []

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a > 0 and r < 50 and g < 60 and b < 80:
            dark_pixels.append((x, y))

if dark_pixels:
    xs = [p[0] for p in dark_pixels]
    ys = [p[1] for p in dark_pixels]
    print(f"Dark pixels bounding box: x={min(xs)} to {max(xs)}, y={min(ys)} to {max(ys)}")
    print(f"Dark pixels found: {len(dark_pixels)}")
    
    # Print y distribution
    y_bins = [0] * 14
    for y in ys:
        y_bins[y // 100] += 1
    
    for i, count in enumerate(y_bins):
        print(f"y={i*100}-{(i+1)*100}: {count} pixels")

