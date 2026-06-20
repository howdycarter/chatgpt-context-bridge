---
name: context-bridge-routing
description: Use when an OpenAI API or GPT-5.5 workflow needs to turn a staged Context Bridge chat into a Homebase markdown draft, Notion draft payload, summary, route recommendation, or image-generation asset manifest. Keeps outputs in staging until explicit review approval.
---

# Context Bridge Routing

Use this skill after a chat has been staged.

Use `search_context` to find staged records, `summarize_thread` to inspect them, `propose_homebase_note` to create a staged markdown draft, `propose_notion_page` to create a staged Notion payload, `register_image_asset` to record existing image files/URLs, and `generate_image_asset` to create a new OpenAI-generated image as a staged local file.

Do not mutate Notion or Homebase canon from this skill. Generated images are staged only until usage rights and publication context are reviewed. Ambiguous material should remain in `00_META/inbox` as a review draft.
