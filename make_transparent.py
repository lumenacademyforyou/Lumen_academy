from PIL import Image

def process_image(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    # We want to replace white-ish pixels connected to the border with transparent.
    # We'll use a simple BFS.
    visited = set()
    queue = []
    
    # Add border pixels to queue if they are white
    def is_white(r, g, b, a):
        return r > 240 and g > 240 and b > 240 and a > 240
        
    for x in range(width):
        if is_white(*pixels[x, 0]):
            queue.append((x, 0))
            visited.add((x, 0))
        if is_white(*pixels[x, height-1]):
            queue.append((x, height-1))
            visited.add((x, height-1))
            
    for y in range(height):
        if is_white(*pixels[0, y]):
            queue.append((0, y))
            visited.add((0, y))
        if is_white(*pixels[width-1, y]):
            queue.append((width-1, y))
            visited.add((width-1, y))
            
    # BFS
    directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    while queue:
        cx, cy = queue.pop(0)
        # Make transparent
        pixels[cx, cy] = (255, 255, 255, 0)
        
        for dx, dy in directions:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if is_white(*pixels[nx, ny]):
                        queue.append((nx, ny))

    img.save(output_path)
    print("Done making outside transparent.")

process_image('public/Copy of Lumen Academy_Logo.png', 'public/Lumen_Academy_Logo_Cropped.png')
