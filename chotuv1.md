# Chotu v1 — Full Spec

*Last updated: May 2026 | Status: Ready for Claude Code*

---

## What is Chotu

A public-facing page at anujk.in where people who'd normally reach out to Anuj can still get a response that sounds and thinks like him — while he's on Vipassana (27th June to 7th July, no phone, no internet, nothing).

Minimal page. A video of Anuj saying "I'm on Vipassana, Chotu is here." A day counter. A chat box. Chotu responds as a transparent proxy — "Anuj thinks..." — grounded in Anuj's own writing.

---

## The Four Use Cases

| Use case | How Chotu handles it |
|---|---|
| Date me | Acknowledges, shares Anuj's vibe/values, says Anuj will follow up |
| Work with me | Goes furthest — understands the need, shares relevant thinking, asks qualifying questions, then hands off |
| Just chat | Engages genuinely from Anuj's writing. No resolution needed |
| Talk to Chotu | Same as above, but Chotu speaks as himself, drops the "Anuj thinks" framing |

**Chotu never fully resolves anything.** He always ends with: "Anuj will follow up when he's back."

**Chotu speaks in third person** — "Anuj believes..." "Anuj's take on this is..." — transparent that he's a proxy, not Anuj.

---

## The Brain — Architecture Decision

**No RAG. Full context window.**

After conversion, all clean articles will fit inside a large context window. Every response has access to everything. Simpler, more coherent, better for the broad human questions people will actually ask.

RAG was rejected because: people won't ask precise questions. They'll ask "what's Anuj like?" — RAG fails at synthesis. Full context wins.

---

## Data Sources

| Source | Files | Words | Status |
|---|---|---|---|
| Obsidian vault | 491 kept | ~136k | keep=yes confirmed |
| Notion pages | 114 kept | ~84k | keep=yes confirmed, sensitive files to be cleaned |
| Medium articles | 10 | ~15k est | Publicly fetchable |
| anujk.in homepage | 1 | ~500 | Fetched |
| anujk.in sub-pages | 8 | unknown | Next.js — needs manual copy-paste |
| **Total** | **~615** | **~220k+** | |

**Sensitive files flagged in Notion (still marked yes — needs manual review before pipeline runs):**
- Srinis Dad Calls / Srinis Mom Calls
- Deep (3 entries)
- Post Page for Deeplink / Page for posts via deeplink

---

## The 10 Categories (Output Articles)

1. `who-anuj-is.md` — identity, background, how he shows up in the world
2. `how-anuj-thinks.md` — mental models, frameworks, first principles
3. `what-anuj-is-building.md` — current projects, startup thinking, what excites him to build
4. `how-anuj-works.md` — collaboration style, what he looks for in people, how he approaches problems
5. `what-anuj-values.md` — health, beauty, depth, Vipassana, what he protects
6. `how-anuj-sees-the-world.md` — takes on society, technology, India, life
7. `who-anuj-really-values.md` — his people, how he thinks about relationships *(sensitivity filter: no named individuals in romantic/personal contexts)*
8. `what-are-anujs-big-bets.md` — future predictions, world + personal bets both
9. `patterns-from-journals.md` — extracted from 5 years of daily writing, how he's changed *(generated, not written)*
10. `current-context.md` — **written by Anuj manually before 27th June. Not generated.**

Output folder: `~/chotu-brain/`

---

## Conversion Pipeline — 3 Passes

### Pass 1 — Topic/Article/Notion → Category Articles

**Routing:** LLM routing call per non-journal file. Each file gets assigned to 1-2 categories.

**Routing rules:**
- All files: LLM decides category
- Category 7 routing prompt must explicitly say: *"Do not route content about specific named individuals in romantic or deeply personal contexts to this category"*
- Category 8 routing: include both world-view writing AND personal journal entries about the future

**Then:** For each category, all routed files are fed into Prompt 1 → output is the category article.

---

### Pass 2 — Journals → Yearly Pattern Documents

**Routing:** By date only. No LLM needed.

| Chunk | Years | Approx files |
|---|---|---|
| Chunk 1 | 2020–2021 | ~120 |
| Chunk 2 | 2022 | ~80 |
| Chunk 3 | 2023 | ~80 |
| Chunk 4 | 2024 | ~80 |
| Chunk 5 | 2025–2026 | ~130 |

Each chunk → Prompt 2 → intermediate file `journal-patterns-[year].md`

---

### Pass 3 — Merge Yearly Docs → Final Patterns Article

5 yearly pattern docs → Prompt 3 → `patterns-from-journals.md`

---

## The 3 Prompt Templates

### Prompt 1 — Topic files → Category article

```
You are building a knowledge base about a person named Anuj Khandalikar.

Below is a collection of his writing — articles, notes, and reflections.
Your job is to synthesise this into a single coherent article about: [CATEGORY NAME]

Rules:
- Write in third person. "Anuj believes..." "Anuj approaches..."
- Preserve his actual voice and specific opinions. Do not generalise.
- Do not invent anything not present in the source material.
- If something is stated multiple times across sources, it is important — emphasise it.
- If sources contradict each other, note both positions with approximate timeframe.
- Length: as long as needed, no longer. Quality over completeness.
- No bullet points. Flowing prose only.
- Do not start with "Anuj is a..." — that's lazy. Start with something specific and true.

Source material:
[RAW CONTENT]
```

---

### Prompt 2 — Journals → Yearly pattern document

```
You are reading one year of daily journal entries written by Anuj Khandalikar.
Context: Anuj is a founder and builder based in Bangalore, IIT Madras alum,
deeply interested in health, writing, and building things that matter.

These are raw, personal, unfiltered. Your job is NOT to summarise what happened.
Your job is to extract patterns about how this person thinks and what matters to him.

Specifically, find:
- What does he keep coming back to, month after month?
- What consistently delights him?
- What consistently troubles or frustrates him?
- How does he talk to himself when things are hard?
- What does he notice about the world that others might miss?
- What has he clearly changed his mind about over this year?
- What does he seem to be searching for?

Output format:
A set of honest observations. Each observation should be specific, not generic.
Bad: "Anuj values health."
Good: "Anuj returns to physical movement — running, walks — as his primary way of
resetting mentally. It appears in his writing every few weeks without fail."

Write in third person. No invented details. Flag uncertainty with "seems to" or "appears to."

Journal entries — [YEAR]:
[RAW CONTENT]
```

---

### Prompt 3 — Merge yearly docs → Final patterns article

```
Below are 5 yearly pattern analyses of Anuj Khandalikar's journal writing,
spanning 2021 to 2026.

Your job is to produce one final coherent article titled "Patterns from Journals."

Specifically:
- What patterns have remained constant across all 5 years? These are core.
- What patterns appeared early and faded? Note the shift.
- What patterns emerged recently that weren't there before? Note the emergence.
- Where has his thinking clearly evolved? Be specific about the direction of change.

This article should read like an honest portrait of how a person thinks and grows
over 5 years — not a list of traits, but a narrative of a mind at work.

Write in third person. Flowing prose. No bullet points.
Preserve his specific language and phrases where they reveal character.

Yearly analyses:
[2021 ANALYSIS]
[2022 ANALYSIS]
[2023 ANALYSIS]
[2024 ANALYSIS]
[2025-2026 ANALYSIS]
```

---

## Output Article Format

```
Filename: [category-slug].md

Structure:
- 3-5 section headers, written as natural phrases not corporate labels
  Good: "The filter he runs everything through"
  Bad: "Overview of thinking style"
- Prose within each section, 2-4 paragraphs
- No bullet points anywhere
- No lists
- Total length: 600-1200 words per article

Tone:
- Third person throughout
- Specific, not generic
- Preserves Anuj's actual language and phrases where they reveal character
- Reads like it was written by someone who knows him well, not an AI summarising notes
```

---

## What Comes After the Brain

Once `~/chotu-brain/` has all 10 articles:

1. **Measure total word count** — almost certainly fits in context window. No RAG needed.
2. **Stuff all articles into Chotu's system prompt** as a single knowledge block.
3. **Build the website** — minimal, personal, Anuj's video, day counter, chat box.
4. **Connect calendar** — Google Calendar already connected, Vipassana dates blocked.
5. **Build conversation log** — every chat summarised and waiting for Anuj on return, ranked by who actually needs follow-up.

---

## The One Thing Claude Code Cannot Do

**Write `current-context.md` yourself. Before the 27th.**

Cover:
- What you're building right now
- What you're open to vs. not open to
- What Vipassana means to you and why you're going
- What you want people to know while you're away
- What you want to come back to

This is the most important file in the brain. Everything else is automated. This one is yours.

---

## Handoff to Claude Code

Open Claude Code and say:
*"I want to build a knowledge base conversion pipeline. I have a complete spec. Let me share it with you."*

Then paste this file.

---

*chotuv1 spec — locked May 2026*
