const { Jimp } = require("jimp");
const fs = require("fs");
const path = require("path");

async function main() {
  const sourcePath = "Copy of Lumen Academy_Logo.png";
  if (!fs.existsSync(sourcePath)) {
    console.error("Source image does not exist:", sourcePath);
    return;
  }

  // Ensure public directory exists
  if (!fs.existsSync("public")) {
    fs.mkdirSync("public");
  }

  // Copy raw image to public/Copy_of_Lumen_Academy_Logo.png & public/Lumen_Academy_Logo.png
  fs.copyFileSync(sourcePath, "public/Lumen_Academy_Logo.png");

  // Load image with Jimp
  const image = await Jimp.read(sourcePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  console.log(`Image size: ${width}x${height}`);

  // Flood-fill white/off-white background starting from the 4 corners
  const isBackground = (color) => {
    const r = (color >> 24) & 255;
    const g = (color >> 16) & 255;
    const b = (color >> 8) & 255;
    const a = color & 255;
    if (a === 0) return true;
    // Off-white paper background check (high brightness in R, G, B with low color saturation)
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return r > 215 && g > 215 && b > 210 && (maxC - minC) < 30;
  };

  const visited = new Uint8Array(width * height);
  const queue = [];

  const addQueue = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      const color = image.getPixelColor(x, y);
      if (isBackground(color)) {
        queue.push(x, y);
      }
    }
  };

  // Add all border pixels to queue
  for (let x = 0; x < width; x++) {
    addQueue(x, 0);
    addQueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    addQueue(0, y);
    addQueue(width - 1, y);
  }

  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    image.setPixelColor(0x00000000, x, y); // make transparent

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        addQueue(nx, ny);
      }
    }
  }

  const transparentPath = "public/Lumen_Academy_Logo_Transparent_Bg.png";
  await image.write(transparentPath);
  console.log("Saved transparent logo to", transparentPath);
}

main().catch(console.error);
