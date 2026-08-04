const { Jimp, rgbaToInt } = require("jimp");

async function processImage() {
  // Read the original logo again to start fresh
  const image = await Jimp.read("public/Copy of Lumen Academy_Logo.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Let's do a flood fill from the corners
  const isWhiteIsh = (color) => {
    const r = (color >> 24) & 255;
    const g = (color >> 16) & 255;
    const b = (color >> 8) & 255;
    const a = color & 255;
    return r > 230 && g > 230 && b > 230 && a > 0;
  };

  const visited = new Set();
  const queue = [];

  const addQueue = (x, y) => {
    const key = `${x},${y}`;
    if (!visited.has(key)) {
      visited.add(key);
      const color = image.getPixelColor(x, y);
      if (isWhiteIsh(color)) {
        queue.push({ x, y });
      }
    }
  };

  // Add borders to queue
  for (let x = 0; x < width; x++) {
    addQueue(x, 0);
    addQueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    addQueue(0, y);
    addQueue(width - 1, y);
  }

  const directions = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    // Diagonals as well to prevent getting stuck
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  let i = 0;
  while (i < queue.length) {
    const { x, y } = queue[i++];
    image.setPixelColor(0x00000000, x, y); // transparent

    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        addQueue(nx, ny);
      }
    }
  }

  await image.write("public/Lumen_Academy_Logo_Transparent_Bg.png");
  console.log("Done generating Transparent Bg logo");
}

processImage().catch(console.error);
