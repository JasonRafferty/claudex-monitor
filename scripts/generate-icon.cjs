// Renders assets/icon.svg to icon.png and a multi-size icon.ico. Run with: npm run icon
const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

const assets = path.join(__dirname, "..", "assets");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const MASTER = 512;

// The SVG has no fixed size, so it fills the window; smaller sizes are scaled down from one render.
async function renderMaster() {
  const win = new BrowserWindow({ width: MASTER, height: MASTER, useContentSize: true, show: false, frame: false, transparent: true });
  await win.loadFile(path.join(assets, "icon.svg"));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage();
  win.destroy();
  return image.resize({ width: MASTER, height: MASTER, quality: "best" });
}

// ICO files may hold PNG data directly; every Windows version since Vista reads it.
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((png) => png.data)]);
}

app.whenReady().then(async () => {
  const master = await renderMaster();
  const pngs = SIZES.map((size) => ({ size, data: master.resize({ width: size, height: size, quality: "best" }).toPNG() }));
  writeFileSync(path.join(assets, "icon.png"), pngs.at(-1).data);
  writeFileSync(path.join(assets, "icon.ico"), buildIco(pngs));
  console.log("Wrote assets/icon.png and assets/icon.ico");
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
