// Start Vite before running. Set CHROMIUM_PATH if using an existing browser.
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const baseURL = process.env.MODEL_PREVIEW_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.route('**/portrait-studio', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto(`${baseURL}/portrait-studio`);
  await mkdir('public/portraits', { recursive: true });
  for (const id of ['kavi', 'aaryan', 'houssam', 'huzaifa', 'lautaro', 'rihabe']) {
    const data = await page.evaluate(async id => {
      const { createCharacterModel, createCharacterStudio, frameCharacterPortrait } = await import('/src/models/characterModel.ts');
      const { disposeModel } = await import('/src/models/assets.ts');
      const canvas = document.createElement('canvas');
      const { renderer, scene, camera } = createCharacterStudio(canvas, 256, 320);
      renderer.setPixelRatio(1); renderer.setSize(256, 320, false);
      const model = await createCharacterModel(id);
      try {
        scene.add(model); frameCharacterPortrait(model, camera); renderer.render(scene, camera);
        return canvas.toDataURL('image/png').split(',')[1];
      } finally { disposeModel(model); renderer.dispose(); }
    }, id);
    await writeFile(`public/portraits/${id}.png`, Buffer.from(data, 'base64'));
    console.log(`Rendered ${id}`);
  }
} finally { await browser.close(); }
