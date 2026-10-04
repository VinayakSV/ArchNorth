# ArchNorth 🧭

A personal learning hub built with **React + Vite** for studying system design, HLD, LLD, and software engineering concepts. Features dark/light themes with eye-friendly colors, markdown-based tutorials with mermaid diagrams, and a personal notes section.

---

## ✨ Features

- **The ShopNorth Journey** — one e-commerce product followed through the whole SDLC (requirements, design, Spring Boot, testing, code quality, Docker, CI/CD, Kubernetes, Datadog, incidents, AI), linked from every topic, with a ☁️ *ShopNorth on AWS* section in most chapters
- **SDLC stage on every topic** — each tutorial opens with a 📍 line saying where it fits in the lifecycle and which story chapter uses it
- **System Design Tutorials** — core concepts (scalability, high availability & DR, CAP and consistency, replication & sharding, consensus), building blocks, and classic designs, plus LLD, with mermaid diagrams
- **AWS for Developers** — 14 tutorials (IAM, VPC, EC2 & Auto Scaling, Lambda, containers, SQS/SNS, EventBridge, MSK, S3, databases, CloudFront, CloudFormation, CloudWatch), each tied to how ShopNorth uses the service
- **Practice everywhere** — every tutorial has 🟢🟡🔴 practice questions with answers, a mini project, and interview questions that also work as flashcards
- **Dark / Light Theme** — Eye-friendly color palette designed to reduce eye strain (warm tones, no pure black/white)
- **Markdown Rendering** — Full GFM support with syntax highlighting and mermaid diagram rendering
- **Notes Section** — Create, edit, delete personal notes with localStorage persistence
- **Responsive** — Works on mobile, tablet, laptop, and desktop
- **Expandable** — Loosely coupled architecture — add new tutorials by dropping a folder + registering it
- **GitHub Pages Deployment** — Automated CI/CD with GitHub Actions

---

## 🗂️ Project Structure

```
ArchNorth/
├── .github/workflows/
│   └── deploy.yml                    # GitHub Actions CI/CD pipeline
├── public/
│   └── 404.html                      # SPA redirect for GitHub Pages
├── src/
│   ├── components/
│   │   ├── common/                   # MarkdownViewer, MermaidDiagram, ScrollToTop
│   │   └── layout/                   # Layout, Header (search), Sidebar (tree nav)
│   ├── content/                      # Tutorial markdown files (132 tutorials)
│   │   ├── journey/                  # 16 · the ShopNorth Journey (start + 15 chapters)
│   │   ├── system-design/            # 26 · core concepts, building blocks, classic designs
│   │   ├── lld/                      # 12 · low-level design
│   │   ├── real-world-builds/        #  2 · data ingestion, live streaming
│   │   ├── architecture-decisions/   #  7 · databases, caching, messaging, security, cloud
│   │   ├── ai-engineering/           # 10 · LLMs, RAG, agents, MCP, LLMOps, AI-SDLC
│   │   ├── microservices/            #  7 · patterns, communication, sagas, Kafka
│   │   ├── java/                     # 15 · core Java, collections, concurrency, JVM
│   │   ├── spring-boot/              #  3 · fundamentals, DI, transactions
│   │   ├── sql/                      #  6 · queries, joins, window functions, indexing
│   │   ├── dsa/                      #  5 · problem-solving patterns
│   │   ├── docker/                   #  3 · fundamentals, Spring Boot images, Compose
│   │   ├── kubernetes/               #  6 · workloads, networking, config, production
│   │   └── aws/                      # 14 · AWS for developers
│   ├── context/                      # React context providers (Theme)
│   ├── features/
│   │   ├── tutorials/
│   │   │   └── tutorialRegistry.js   # Central tutorial config (order = sidebar and Prev/Next order)
│   │   └── notes/
│   ├── hooks/                        # Custom hooks (useThemeMode)
│   ├── pages/                        # Route-level pages (Dashboard, Tutorials, TutorialDetail)
│   ├── styles/                       # SCSS (variables, mixins, global)
│   ├── theme/                        # MUI theme configuration
│   ├── App.jsx                       # Root component with lazy routing
│   └── main.jsx                      # Entry point
├── index.html
├── vite.config.js                    # Manual chunks, base path config
└── package.json
```

---

## 🚀 Running Locally

### Prerequisites

- **Node.js** >= 18 (recommended: 20+)
- **npm** >= 9

### Windows

```powershell
# Clone the repo
git clone https://github.com/VinayakSV/ArchNorth.git
cd ArchNorth

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173/ArchNorth/` in your browser.

### macOS / Linux

```bash
# Clone the repo
git clone https://github.com/VinayakSV/ArchNorth.git
cd ArchNorth

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173/ArchNorth/` in your browser.

### Build for Production

```bash
npm run build     # Output in dist/
npm run preview   # Preview the production build locally
```

---

## 📖 How to Add a New Tutorial

Adding a new tutorial takes 2 steps:

### Step 1: Create the markdown file

Create a folder under `src/content/<category>/` with a markdown file matching the tutorial id:

```
src/content/system-design/chat-system/chat-system.md
```

Write your tutorial following the **Content Authoring Guide** below.

### Step 2: Register it

Open `src/features/tutorials/tutorialRegistry.js` and add an entry:

```js
{
  id: 'chat-system',                    // must match folder name AND md filename
  title: 'Chat System',
  description: 'Design a real-time messaging system',
  category: 'System Design',
  subcategory: 'Classic Designs',
  icon: CloudQueue,                      // any MUI icon
  tags: ['HLD', 'LLD', 'WebSocket'],
},
```

If adding a new category, update `getCategoryIcon()` in the same file.

That's it. The app auto-discovers the `.md` file by matching the `id` to the folder name.

---

## ✍️ Content Authoring Guide — The Master Prompt

Use this as a structured prompt when creating or modifying any tutorial. This ensures every topic has consistent quality, interview readiness, and scenario-based depth.

### The Prompt

Copy and adapt this for every new tutorial or enhancement:

```
Create/Update tutorial: [TOPIC NAME]
Category: [System Design | Microservices | Java | Architecture Decisions | Real-World Builds | DSA | ...]
Subcategory: [e.g., Classic Designs, Concurrency & Parallelism, Data Layer, ...]

Follow this structure EXACTLY:

─────────────────────────────────────────────
1. TITLE & OPENING ANALOGY
─────────────────────────────────────────────
- Title format: "[Topic] — [Subtitle that tells what you'll learn]"
- Open with a real-world analogy (restaurant, library, post office, city, etc.)
- The analogy must make the concept click for someone with ZERO background
- No textbook definitions — explain like you're talking to a smart colleague

─────────────────────────────────────────────
2. CORE CONCEPTS (Scenario-Driven)
─────────────────────────────────────────────
- Teach each concept through a SCENARIO, not a definition
  Bad:  "A HashMap uses hashing to store key-value pairs"
  Good: "You do map.put('name', 'Alice') — here's what happens step by step"
- Use code examples that are REAL (e-commerce, payment, user service — not Foo/Bar)
- Show the WRONG way first (❌), then the RIGHT way (✅) with explanation
- Use mermaid diagrams for any flow, architecture, or state transition:
  - sequenceDiagram for request flows
  - graph/flowchart for architecture
  - stateDiagram for state machines
  - classDiagram for OOP/LLD
  - gitGraph for branching strategies
- Use comparison tables (| Feature | Option A | Option B |) for decision-making
- Keep code blocks short and focused — max 20-30 lines per block

─────────────────────────────────────────────
3. CALLOUT BOXES (Mandatory — use ALL types where relevant)
─────────────────────────────────────────────
Scatter these THROUGHOUT the tutorial body, not just at the end:

a) SCENARIO BOX (purple) — Decision-making context
   <div class="callout-scenario">
   **Scenario**: [Real situation]. **Answer/Decision**: [What to pick and why].
   </div>

b) APPLYING THIS BOX (green) — Practical takeaway for real projects
   <div class="callout-tip">
   **Applying this** — [How to use this in your actual codebase/team/architecture].
   </div>

c) INTERVIEW READY BOX (red) — Inline interview tips within the tutorial body
   <div class="callout-interview">
   🎯 **Interview Ready** — "[Exact question]" → [Concise, confident answer].
   </div>

d) INFO BOX (blue) — Important notes, rules, or gotchas
   <div class="callout-info">
   [Important technical note or rule to remember].
   </div>

e) WARNING BOX (yellow) — Common mistakes or dangers
   <div class="callout-warn">
   [Warning about a common pitfall or anti-pattern].
   </div>

MINIMUM per tutorial:
- 2+ scenario boxes
- 2+ applying-this boxes
- 2+ inline interview-ready boxes (within the body)

─────────────────────────────────────────────
4. 🎯 INTERVIEW CORNER (Dedicated Section — MANDATORY)
─────────────────────────────────────────────
Place this as the LAST major section (before Quick Reference if one exists).

Format:
## 🎯 Interview Corner

Include 3-5 questions, each as a separate callout-interview div:

<div class="callout-interview">

**Q: "[Exact question as an interviewer would ask it]"**

[Answer: 4-6 sentences. Confident, structured, scenario-backed.
 Start with the direct answer, then explain WHY, then give a real example.
 End with a trade-off or nuance that shows depth.]

**Follow-up trap**: "[The gotcha follow-up]" → [How to handle it].

</div>

Question design rules:
- Phrase questions EXACTLY as interviewers ask them (not textbook style)
- Answers must be speakable — imagine saying this out loud in an interview
- Include at least 1 "design/architecture" question ("How would you design...")
- Include at least 1 "compare/contrast" question ("X vs Y, when would you...")
- Include at least 1 "debugging/production" question ("Your system is doing X, how do you fix...")
- Add "Follow-up trap" to at least 2 questions — the gotcha the interviewer throws next
- Answers should reference real technologies (Redis, Kafka, PostgreSQL, Spring, etc.)

─────────────────────────────────────────────
5. QUICK REFERENCE / CHEAT SHEET (Optional but recommended)
─────────────────────────────────────────────
- Summary table or code-style cheat sheet at the very end
- One-liner per concept — scannable in 30 seconds
- Use for revision before interviews

─────────────────────────────────────────────
6. CLOSING QUOTE
─────────────────────────────────────────────
- End with a > blockquote — one golden rule or key insight
- This should be the ONE thing someone remembers from the entire tutorial

─────────────────────────────────────────────
CONTENT RULES (Non-Negotiable)
─────────────────────────────────────────────
✅ DO:
- Use real-world scenarios (e-commerce, payment, social media, banking)
- Show code in Java (primary), with SQL/bash/config where relevant
- Explain trade-offs, not just "how" — always answer "when" and "why not"
- Make it simple enough for anyone to understand, yet detailed enough to impress
- Use ❌/✅ markers for wrong/right approaches
- Keep the tone conversational — "you", "your", "imagine", "think of it as"

❌ DON'T:
- Use textbook definitions as opening lines
- Use Foo/Bar/Baz in code examples
- Write walls of text without code, diagrams, or tables
- Add interview content that just restates the tutorial — it must add NEW depth
- Use generic answers like "it depends" without explaining WHAT it depends on
- Skip the "when NOT to use" — knowing when to avoid something is more valuable
```

### Checklist Before Committing Any Tutorial

```
Content Quality:
  □ Opens with a relatable analogy (not a definition)
  □ Every concept taught through a scenario or example
  □ Code examples use real-world entities (Order, User, Payment — not Foo/Bar)
  □ ❌ Wrong way shown before ✅ Right way
  □ Mermaid diagrams for all flows and architectures
  □ Comparison tables for all "X vs Y" decisions

Callout Boxes:
  □ 2+ callout-scenario (purple) — decision-making contexts
  □ 2+ callout-tip (green) — "Applying this" practical takeaways
  □ 2+ callout-interview (red) — inline interview tips in body
  □ callout-info / callout-warn used where relevant

Interview Corner (dedicated section):
  □ 3-5 real interview questions
  □ Questions phrased as interviewer would ask
  □ Answers are speakable (4-6 sentences, confident tone)
  □ At least 1 design question, 1 compare question, 1 debugging question
  □ At least 2 follow-up traps included
  □ Answers reference real technologies

Structure:
  □ File: src/content/<category>/<id>/<id>.md
  □ Registered in tutorialRegistry.js with id, title, description,
    category, subcategory, icon, tags
  □ getCategoryIcon() updated if new category
  □ Starts with the 📍 SDLC stage block right after the title
    (<!-- sdlc-stage:start --> … <!-- sdlc-stage:end -->)
  □ 🏋️ Practice Assignments (🟢 / 🟡 / 🔴, answers in <details>) and a 🛠️ Mini Project
  □ Quick reference / cheat sheet at the end
  □ Closing blockquote with golden rule
  □ Ends with the 🛒 ShopNorth Journey box linking to the matching chapter
    (<!-- journey-link:start --> … <!-- journey-link:end -->)
  □ Build passes (npm run build)
```

### Callout Box Reference

| Callout | Class | Color | Use For |
|---------|-------|-------|---------|
| Scenario | `callout-scenario` | Purple | "You're building X. Here's the decision..." |
| Applying This | `callout-tip` | Green | "In your real project, do this..." |
| Interview Ready | `callout-interview` | Red | "🎯 Interview Ready" tips + Q&A |
| Info | `callout-info` | Blue | Important rules, key facts |
| Warning | `callout-warn` | Yellow | Common mistakes, anti-patterns |
| ShopNorth Journey | `callout-journey` | Orange | The main story: chapter headers and the "continue the journey" box at the end of every tutorial |

HTML format (required — markdown classes don't work, must use raw HTML):

```html
<div class="callout-scenario">

**Scenario**: Your team is building a payment service that processes 10K TPS.
**Decision**: Use event-driven architecture with Kafka because...

</div>

<div class="callout-tip">

**Applying this** — In production, always set connection pool timeouts...

</div>

<div class="callout-interview">

**Q: "How would you handle distributed transactions across microservices?"**

I'd use the Saga pattern with orchestration because...

**Follow-up trap**: "What about 2PC?" → Avoid in microservices because...

</div>
```

> **Note**: There must be a blank line after the opening `<div>` tag and before the closing `</div>` tag for markdown to render inside the HTML block.

**Linking to other tutorials:** write `[Chapter 5 · Building with Spring Boot](/tutorials/journey-05-spring-boot)` — links to `/tutorials/<id>` open inside the app; every other link opens in a new tab. End every new tutorial with a ShopNorth Journey box (between `<!-- journey-link:start -->` and `<!-- journey-link:end -->`) that says how ShopNorth uses the topic and links to the matching chapter.

### Example: Minimal Tutorial Skeleton

```markdown
# [Topic] — [Subtitle]

## The [Analogy] Analogy

[2-3 sentences making the concept click]

---

## 1. [Core Concept 1]

### Scenario: [Real situation]

[Code + explanation]

<div class="callout-scenario">

**Scenario**: [Decision context]. **Answer**: [What to pick and why].

</div>

---

## 2. [Core Concept 2]

[Code + mermaid diagram + comparison table]

<div class="callout-tip">

**Applying this** — [Practical takeaway for real projects].

</div>

---

## 3. [Core Concept 3]

[...]

<div class="callout-interview">

🎯 **Interview Ready** — "[Question]" → [Concise answer with trade-offs].

</div>

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "[Real interview question]"**

[4-6 sentence answer. Direct, confident, scenario-backed.]

**Follow-up trap**: "[Gotcha]" → [How to handle it].

</div>

<div class="callout-interview">

**Q: "[Another real question]"**

[Answer with real-world example and trade-off.]

</div>

[... 1-3 more questions ...]

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| [X] | [Summary] |
| [Y] | [Summary] |

---

> **[Golden rule / key insight — the ONE thing to remember]**
```

---

## 🎨 Theming

The app uses a **medical-grade eye-friendly** color palette:

| Property | Light Theme | Dark Theme |
|----------|-------------|------------|
| Background | `#f5f0eb` (warm off-white) | `#1a1b1e` (deep warm gray) |
| Paper | `#faf7f3` | `#242529` |
| Text Primary | `#2d2a26` | `#e0dcd5` |
| Accent | `#4a7c6f` (sage green) | `#7fbfae` (soft teal) |

**Why these colors?**
- No pure white (`#fff`) or pure black (`#000`) — reduces contrast glare
- Warm undertones reduce blue light emission
- Accent colors are in the green spectrum — easiest on the eyes
- Meets WCAG AA contrast ratios

---

## 🚢 Deploying to GitHub Pages

### Automatic (CI/CD)

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on every push to `master`.

#### Setup Steps:

1. **Create a GitHub repository** named `ArchNorth`

2. **Push your code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M master
   git remote add origin https://github.com/VinayakSV/ArchNorth.git
   git push -u origin master
   ```

3. **Enable GitHub Pages:**
   - Go to your repo → **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - The workflow will trigger automatically on push

4. **Access your site:**
   ```
   https://vinayaksv.github.io/ArchNorth/
   ```

### How the Pipeline Works

The `deploy.yml` workflow does the following:

```
Push to master → Checkout code → Setup Node 22 → npm ci → npm run build → Upload dist/ → Deploy to Pages
```

| Step | What it does |
|------|-------------|
| `actions/checkout@v4` | Clones your repo |
| `actions/setup-node@v4` | Installs Node.js 22 with npm cache |
| `npm ci` | Clean install of dependencies (faster than `npm install`) |
| `npm run build` | Runs `vite build`, outputs to `dist/` |
| `upload-pages-artifact@v3` | Packages `dist/` for GitHub Pages |
| `deploy-pages@v4` | Deploys the artifact to GitHub Pages |

The `404.html` in `public/` handles SPA routing — GitHub Pages serves it for any unknown path, and the script redirects to `index.html` preserving the route.

### Manual Deployment

If you prefer manual deployment:

```bash
npm run build
# Then upload the dist/ folder to any static hosting (Netlify, Vercel, S3, etc.)
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| Vite 6 | Build tool & dev server |
| Material UI 7 (MUI) | Component library |
| SCSS | Styling with variables & mixins |
| React Router 7 | Client-side routing |
| react-markdown | Markdown rendering |
| react-syntax-highlighter | Code block highlighting |
| Mermaid | Diagram rendering in markdown |
| GitHub Actions | CI/CD pipeline |
| GitHub Pages | Static hosting |

---

## 👤 Author

ArchNorth was designed, curated, and directed by **[VinayakSV](https://github.com/VinayakSV)** and built with AI assistance. Feedback and corrections are welcome at **archnorth.learn@gmail.com** (subject starting with `[ArchNorth Feedback]`), or use the Feedback page in the app.

---

## 🔒 Privacy

- Notes and the theme choice are stored only in the visitor's browser (localStorage). Nothing is sent to a server.
- A service worker caches the site's files for offline use. It stores no personal data.
- Fonts (Inter, Fira Code) are bundled with the site, so pages never contact Google Fonts.
- Google Analytics 4 runs in consent mode with storage denied: no analytics or advertising cookies, but Google still receives cookieless page-view pings (IP address, browser details).
- GitHub Pages hosts the site, and GitHub logs visitor IP addresses for security.
- Google sign-in (Firebase) is used only for the owner's private page, and Firebase loads only on that page; visitors never sign in.
- Feedback is sent by email (`archnorth.learn@gmail.com`); addresses and messages are used only to reply and improve ArchNorth.

The same notice appears on the in-app **License** page.

---

## 📝 License & Legal

### Code — MIT License

All source code in this repository (everything **except** the `src/content/` directory) is licensed under the [MIT License](./LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the code, provided you include the original copyright notice and license text.

### Tutorial Content — Creative Commons BY-NC-SA 4.0

All tutorial content — markdown files, diagrams, written explanations, and any other educational material inside the `src/content/` directory — is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/), **except the code examples** (see the next section).

This means you **can**:
- ✅ Read, learn from, and reference the content
- ✅ Share it with attribution (link back to this repo)
- ✅ Adapt or remix it for **non-commercial** purposes, as long as you share under the same license

This means you **cannot**:
- ❌ Republish the content on your own site/blog/course without attribution
- ❌ Use the content for commercial purposes (paid courses, books, monetized blogs) without written permission
- ❌ Remove or alter the copyright notice

**Attribution format**: "Content from [ArchNorth](https://github.com/VinayakSV/ArchNorth) by VinayakSV, licensed under CC BY-NC-SA 4.0."

### Code Examples in Tutorials — MIT No Attribution (MIT-0)

The code examples inside the tutorials — source code, SQL queries, configuration files, and commands shown in code blocks — are licensed under [MIT No Attribution (MIT-0)](./LICENSE-CODE-EXAMPLES). You can copy, use, and change them anywhere, including in commercial and work projects, without credit.

Diagrams (including Mermaid diagram definitions) and the written explanations stay under CC BY-NC-SA 4.0. A code block that names a different license or source keeps its own license.

### Contributing

Contributions are welcome once this project is open for collaboration. By submitting a pull request, you agree that:

1. Your code contributions are licensed under the **MIT License**
2. Your content contributions (tutorials, markdown, diagrams) are licensed under **CC BY-NC-SA 4.0**, and the code examples in them under **MIT-0**
3. You have the right to submit the contribution and it does not violate any third-party rights
4. The project maintainers may edit, restructure, or remove your contribution as needed

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute.

### Deployment Branch

Every push to `master` builds and deploys the live site through `.github/workflows/deploy.yml`, so review changes before pushing.

### Trademarks

"ArchNorth" and the ArchNorth logo (if any) are **not** covered by the MIT or CC license. You may not use the project name or branding to imply endorsement of your own project without written permission.

### Third-Party Content

This project uses open-source libraries listed in `package.json`. Each library retains its own license. Every production build writes `third-party-licenses.txt` (served at `/ArchNorth/third-party-licenses.txt`) with the version, copyright notice, and full license text of each package the site ships, including the Workbox service-worker code and the bundled Inter and Fira Code fonts (SIL Open Font License 1.1). The build fails if a shipped package's license isn't on the permissive allowlist in `scripts/third-party-notices.js`.

Tutorials may reference third-party technologies (Redis, Kafka, Spring, AWS, etc.) — all trademarks belong to their respective owners and are used here for educational purposes only. Case studies named after real products (Netflix, Uber, WhatsApp, and others) are simplified descriptions of publicly known system designs, not official or insider accounts; ArchNorth is not affiliated with or endorsed by any of these companies.

### Fictional Examples

ShopNorth, the company in the ShopNorth Journey, is fictional, as are the other example companies, people, and sample data (including the SQL playground's airline data). Any resemblance to real companies or people is coincidental. Interview questions are original practice questions, not questions taken from any company's interviews.

### Rights Concerns

If you believe something in ArchNorth infringes your copyright or other rights, email `archnorth.learn@gmail.com` with the details. It will be reviewed promptly, and corrected or removed.

### Disclaimer

THIS PROJECT IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. THE AUTHORS AND CONTRIBUTORS ARE NOT LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE USE OF THIS SOFTWARE OR CONTENT. THE TUTORIALS ARE FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE TREATED AS PROFESSIONAL ADVICE.

---

**Copyright © 2026 VinayakSV. All rights reserved where applicable.**

Project created on April 1, 2026 | Code: [MIT](./LICENSE) | Content: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | Code examples in tutorials: [MIT-0](./LICENSE-CODE-EXAMPLES)
