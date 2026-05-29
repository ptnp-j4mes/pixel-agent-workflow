# setting-config.json

`app/config/setting-config.json` is the central place for UI defaults that should not be hard-coded in the React component.

Currently it controls:

- `storageKey`: localStorage key for persisted scene layout.
- `sceneLayers`: z-index ordering for background, sprites, workflow bubbles, objects, HUD, and floating panels.
- `workflowEditor`: visual mode for the workflow editor. The current mode is `pixel-bubble`.
- `defaults.workflowDockFrame`: default position and size of the Workflow / Free-style Prompt frame.
- `defaults.panels`: default positions for Memory, Workflow Map, Progress, and Topbar panels.
- `defaults.sceneButtonFrames`: default freestyle positions for scene buttons.

Scene objects intentionally use a higher layer than sprites so desks and other objects can visually sit in front of walking agents.
