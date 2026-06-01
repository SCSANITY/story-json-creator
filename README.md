# YMI Story JSON Creator

Desktop tool for producing subtitle layout JSON files for YMI story templates.

## Run in development

```bash
cd d:\IT_David\Program\Voice Imagination\Web\subtitle-template-editor-app
npm install
npm run dev
```

## Build Windows app

```bash
cd d:\IT_David\Program\Voice Imagination\Web\subtitle-template-editor-app
npm install
npm run dist
```

The installer and unpacked executable will be written to:

- `release/`

## Main capabilities

- Upload multiple background pages
- Add subtitle text layers
- Drag and resize text layers
- Adjust font, gradient, shadow, opacity, and box styling
- Preview `{name}` placeholder replacement
- Export production-ready JSON

## Current worker contract

- The editor is an offline authoring tool, not part of the runtime pipeline.
- Runtime placeholder replacement is locked to `{name}`.
- Worker-side text rendering is handled by `subtitle_render`.
- AI providers only receive already-rendered subtitle images for face/upscale work.

## Recommended publishing flow

1. Author or revise page-level subtitle JSON in this app.
2. Export the page JSON.
3. Merge the pages into one story-level `subtitle-template.json`.
4. Upload:
   - `subtitle-template.json`
   - required fonts under `app-templates/<template_id>/fonts/`
5. Let `worker` consume the template through `subtitle_render`.
