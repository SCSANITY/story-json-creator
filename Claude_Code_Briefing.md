# Claude Code Briefing
## YMI Story JSON Creator + Subtitle Pipeline Context

Last updated: 2026-04-08

This file is a working briefing for the standalone subtitle-template app and the larger YMI production pipeline around it.

It should help a new collaborator understand:

1. What this app is for
2. What the current main site / worker / AI architecture looks like
3. What is changing next
4. What Claude Code should focus on for this app
5. What should remain outside this app

---

## 1. What this app actually is

App name:
- **YMI Story JSON Creator**

This is a **standalone internal desktop tool**, not a customer-facing product.

Its purpose is:
- load story background images
- place subtitle text blocks on each page
- configure style, position, width, height, shadow, opacity, box appearance, etc.
- use placeholder text such as `{name}`
- export the final result as a **JSON subtitle template**

This app is **not** responsible for:
- customer-facing website rendering
- live order handling
- direct worker execution
- direct AI calls
- direct database writes in the production system

In short:

> This app is an offline JSON production tool for story subtitle templates.

Once a story's subtitle JSON has been prepared, this app has done its job.

---

## 2. Current broader project reality

### Main site
- Project: `ymi-books-web-1.0`
- Stack: `Next.js`
- Main domain: `https://www.ymistory.com`

### Backend / storage
- Database and storage: `Supabase`
- Template assets bucket: `app-templates`
- Private user/generated assets bucket: `raw-private`

### Worker
- Project: `worker/`
- Current responsibility:
  - claim `jobs`
  - process `preview` and `final`
  - read template config
  - call AI workflow
  - collect result images
  - upload outputs
  - update `jobs / creations / orders`

### Current AI workflow status
- Right now, the team is still using **RunComfy** for workflow debugging and validation
- This is a temporary/debugging path
- It is **not** the intended long-term production runtime

---

## 3. Important architecture update

This is critical:

### 3.1 Future face-swap workflow will NOT stay on RunComfy

The future production plan is:
- the currently tested face-swap workflow will be moved away from RunComfy
- it will run on **RunPod cloud GPU**
- the team does **not** want to rely on ComfyUI/RunComfy as the production runtime model

So the correct mental model is:

- **RunComfy** = current debugging / temporary workflow validation environment
- **RunPod** = future production execution environment for face swap + upscale

This distinction matters and should not be blurred in future implementation notes.

### 3.2 Subtitle replacement will move into the worker

Previously, the rough idea was:
- worker sends the job to an AI workflow
- AI handles face swap + text replacement + upscale

The new target architecture is:

1. worker claims job
2. worker reads subtitle JSON
3. worker replaces placeholders such as `{name}`
4. worker renders subtitles locally onto clean background pages
5. worker sends the subtitle-rendered images into the AI workflow
6. AI workflow handles:
   - face swap
   - upscale

So the new architecture is:

> subtitle rendering happens before the AI workflow, inside the worker-side pipeline

---

## 4. Role of the JSON template

The JSON produced by this app is the **subtitle layout template** for a story.

It should represent:
- one story
- all relevant pages for that story
- all text blocks per page
- all style and layout instructions needed for deterministic rendering

The JSON is not a final image.

It is a rendering instruction set.

The worker will later consume this JSON and produce subtitle-rendered page images.

---

## 5. Placeholder rules

### Required rule
Wherever the customer's name should appear, template authors must use:

```txt
{name}
```

### Do not use other variants
Do not mix:
- `[name]`
- `{{name}}`
- `<name>`
- `{child_name}`
- `%name%`

Only use:
- `{name}`

This must remain a strict convention.

---

## 6. Text rendering behavior expected from the worker

The worker should not simply do a naive string replacement and paint the text.

The intended flow is:

1. read JSON
2. replace `{name}` with the actual customer/child name from the job
3. measure the resulting text
4. adapt layout based on the real rendered length
5. render onto the clean page image

This means the subtitle rendering stage must use JSON fields such as:
- `autoScale`
- `maxWidth`
- `boxWidth`
- `boxHeight`
- `letterSpacing`
- `lineHeight`
- `size`
- `boxPaddingX`
- `boxPaddingY`
- color / shadow / box style settings

The point is:
- long names should not overflow badly
- short names should still look balanced
- output should stay close to the preview the template author saw in the app

---

## 7. Typography requirements

Another important update:

### 7.1 Cover title font vs body font
The story cover title font and the body/subtitle font are **not always the same**.

This means the app must support:
- one font choice for cover/title text
- potentially different font choices for regular body text

### 7.2 Story-to-story variation
Different stories may use slightly different title fonts on the cover.

The difference may not be huge, but it is real enough that:

> the app should provide a broader set of font choices than it currently has

This is a valid future enhancement for the tool.

---

## 8. Current app baseline

The app is already partially modified and improved.

This matters:

> Future work should continue from the current edited version of the app, not from the original raw prototype.

The current app already includes improvements such as:
- larger text boxes
- draggable and resizable text regions
- property panel workflow
- JSON preview/export
- multiple box styles
- better default subtitle-box behavior
- packaging as a standalone Windows app

So any future optimization should build on the current version.

---

## 9. Ownership / handoff boundary

This is also important:

### Claude Code should own this app going forward
You plan to let **Claude Code** continue the optimization and refinement of this standalone JSON creator app.

That means Claude Code should focus on:
- app usability
- subtitle-template authoring workflow
- font options
- text box behavior
- export format quality
- future editor ergonomics

### Codex should not continue owning this standalone tool
For this tool, Codex is no longer the primary implementation owner.

Codex should instead continue focusing on:
- UI/UX for the main web product
- full-stack integration planning
- worker architecture changes
- DB / API / storage / production system design
- subtitle pipeline integration into the main platform

In short:

- **Claude Code** = standalone JSON app refinement
- **Codex** = website + worker + full-stack architecture and integration

---

## 10. What this app should NOT become

This app should not turn into:
- a full CMS
- a customer-facing editor
- a runtime subtitle renderer
- a direct replacement for the worker
- a tightly coupled part of the main website

Keep it lightweight and focused:

> create subtitle JSON cleanly, then exit

---

## 11. Expected next major engineering milestone

The next major system change is not more polish on the app alone.

The next major milestone is:

1. finalize subtitle JSON templates for real stories
2. add a subtitle render stage inside the worker
3. move text replacement out of the AI workflow
4. keep AI focused on face swap + upscale only
5. later migrate production execution from RunComfy-debugging to RunPod production infrastructure

Target pipeline:

```txt
job
-> worker reads subtitle JSON
-> worker replaces {name}
-> worker renders subtitles onto clean story pages
-> rendered pages are passed into AI workflow
-> AI performs face swap + upscale
-> worker uploads results and updates job state
```

---

## 12. Summary for future collaborators

If you are working on this app, remember:

- it is an internal JSON authoring tool
- its output is JSON, not final customer images
- `{name}` is the required placeholder
- story title fonts and body fonts may differ
- more font choice support is expected
- current RunComfy usage is temporary/debug-oriented
- future production face-swap execution is expected to run on RunPod
- subtitle rendering itself will move into the worker

If you are working on the full production stack, remember:

- do not leave text replacement inside the AI workflow
- the worker should become the deterministic subtitle renderer
- the app and the worker are separate tools with separate responsibilities

That separation is intentional and should be preserved.
