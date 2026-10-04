# Contributing to ArchNorth

Thank you for your interest in contributing! This document explains how to contribute and the rules you must follow.

---

## How to Contribute

1. **Fork** this repository
2. **Create a branch** from `master` (`git checkout -b feature/your-feature`)
3. **Make your changes** following the guidelines below
4. **Test locally** — run `npm run dev` and `npm run build` to verify nothing breaks
5. **Submit a Pull Request** against `master`

All PRs require review and approval from a maintainer before merging.

---

## What You Can Contribute

- **New tutorials** — Follow the Content Authoring Guide in the README
- **Bug fixes** — Fix broken links, rendering issues, typos
- **Feature improvements** — UI/UX enhancements, performance optimizations
- **Documentation** — Improve README, add examples, clarify instructions

---

## Rules

### Code Contributions
- Follow the existing code style (React functional components, MUI, hooks)
- No new dependencies without asking first (email `archnorth.learn@gmail.com`). Shipped dependencies must use a permissive license; `npm run build` fails otherwise
- All code must pass `npm run build` without errors
- Do not commit `.env` files, secrets, API keys, or credentials

### Content Contributions
- Follow the **Content Authoring Guide** in the README strictly
- Use real-world scenarios — no Foo/Bar/Baz examples
- Include callout boxes (scenario, tip, interview, info, warn) as documented
- Include an Interview Corner section with 3-5 questions
- Test markdown rendering locally before submitting

### Commit Messages
- Use clear, descriptive commit messages
- Format: `type: short description` (e.g., `feat: add caching tutorial`, `fix: sidebar collapse bug`)

---

## Licensing of Contributions

By submitting a pull request, you agree that:

- **Code** you contribute is licensed under the [MIT License](./LICENSE)
- **Content** (tutorials, markdown, diagrams) you contribute is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Code examples** inside the tutorials you contribute (code blocks other than Mermaid diagrams) are licensed under [MIT No Attribution (MIT-0)](./LICENSE-CODE-EXAMPLES), so learners can reuse them anywhere
- You have the legal right to make the contribution
- Your contribution does not contain copyrighted material from others (unless properly attributed and compatible with our licenses)
- Maintainers may edit, restructure, or remove your contribution

---

## Code of Conduct

- Be respectful and constructive
- No harassment, discrimination, or personal attacks
- Focus on the work, not the person
- If you disagree, explain your reasoning with evidence

Violations may result in your contributions being rejected and access being revoked.

---

## Questions?

Email `archnorth.learn@gmail.com` (subject starting with `[ArchNorth Feedback]`) if you're unsure about anything before contributing.
