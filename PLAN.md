# Weave — Projektplan

## Vision
Ein AI-Workflow-Framework das sich innerhalb von AI-Coding-Tools (Claude Code, Cursor, Codex etc.) installiert, den User durch ein intelligentes Onboarding führt, und einen komplett personalisierten Workflow generiert — der sich im Hintergrund kontinuierlich weiterentwickelt.

---

## Architektur

### Grundprinzip
Weave ist **kein standalone CLI**. Es lebt innerhalb des Host-AI-Tools. Die gesamte Intelligenz kommt vom LLM des jeweiligen Tools. Weave liefert das Meta-Wissen, die Struktur und die Automation.

### Einzige Ausnahme: Der Installer
`npx weave` ist ein kleines TypeScript-CLI das:
- ASCII-Banner zeigt
- Erkennt welches AI-Tool genutzt wird (Claude Code, Cursor, Codex etc.)
- Die Weave-Files an die richtige Stelle kopiert
- Den User auffordert `/weave:onboarding` zu starten

### Projektstruktur
```
weave/
├── package.json
├── tsconfig.json
├── src/
│   └── install.ts                  # CLI Installer + Banner
├── commands/                       # Slash Commands (Markdown)
│   ├── onboarding.md              # /weave:onboarding
│   ├── evolve.md                  # /weave:evolve
│   ├── sync.md                    # /weave:sync
│   ├── add-agent.md               # /weave:add-agent
│   ├── add-skill.md               # /weave:add-skill
│   ├── add-team.md                # /weave:add-team
│   └── status.md                  # /weave:status
├── master-instructions/           # Meta-Wissen (Markdown)
│   ├── agents.md                  # Was macht einen guten Agent aus
│   ├── skills.md                  # Wie baut man effektive Skills
│   ├── rules.md                   # Welche Rules wann und warum
│   ├── subagents.md               # Subagent-Patterns & Best Practices
│   ├── teams.md                   # Agent-Teams & Orchestrierung
│   └── context-management.md     # Context-Window effizient nutzen
├── hooks/                         # JavaScript Hooks
│   ├── evolve-hook.js             # Background-Optimierung
│   └── context-guard.js           # Context-Window Überwachung
├── agents/                        # Weave's eigene Subagents (Markdown)
│   ├── onboarding-agent.md        # Führt das Onboarding-Gespräch
│   ├── architect-agent.md         # Designed Agent-Teams & Workflow
│   ├── optimizer-agent.md         # Analysiert & verbessert Setup
│   └── sync-agent.md              # Übersetzt zwischen Plattformen
├── adapters/                      # Platform-Wissen (Markdown)
│   ├── claude-code.md             # Wie .claude/ strukturiert sein muss
│   ├── cursor.md                  # Wie .cursor/ und .cursorrules funktionieren
│   ├── codex.md                   # Codex Config Format
│   └── windsurf.md                # Windsurf/Codeium Format
└── core/
    └── schema.md                  # Weave's universelles Datenformat
```

---

## Features im Detail

### 1. Installer (`npx weave`)
**Was er tut:**
- Zeigt ASCII-Banner:
```
 ██╗    ██╗███████╗ █████╗ ██╗   ██╗███████╗
 ██║    ██║██╔════╝██╔══██╗██║   ██║██╔════╝
 ██║ █╗ ██║█████╗  ███████║██║   ██║█████╗
 ██║███╗██║██╔══╝  ██╔══██║╚██╗ ██╔╝██╔══╝
 ╚███╔███╔╝███████╗██║  ██║ ╚████╔╝ ███████╗
  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝

  🧶 Your AI workflow, woven to perfection.
```
- Erkennt Platform (schaut nach .claude/, .cursor/ etc. oder fragt)
- Kopiert Commands, Agents, Hooks, Master-Instructions an die richtige Stelle
- Erstellt `.weave/` Ordner im Projekt für Weave's eigenen State
- Gibt Hinweis: "Run /weave:onboarding to get started"

**Tech:** TypeScript, minimale Dependencies (nur `picocolors` für Farben)

### 2. Onboarding (`/weave:onboarding`)
**Was es tut:**
Der Onboarding-Agent führt ein natürliches Gespräch mit dem User. Kein starrer Fragebogen — das LLM passt die Fragen an basierend auf vorherigen Antworten.

**Abschnitte:**

**A) User-Profil**
- Wer bist du? (Rolle, Erfahrung)
- Wie arbeitest du? (Solo/Team, Workflow-Gewohnheiten)
- Welche Tools nutzt du?
- Was nervt dich an deinem aktuellen Setup?
- Preferences (Sprache, Stil, Detaillevel)

**B) Projekt-Verständnis**
- Was baust du? Vision, Ziel
- Welche Features sind geplant?
- Tech-Stack & Architektur-Entscheidungen
- Milestones, Prios, Deadlines
- Wer arbeitet noch dran?

**C) Workflow-Design**
- Basierend auf A + B schlägt Weave einen Workflow vor
- User kann anpassen, Feedback geben
- Iterativ bis der User zufrieden ist

**Output:**
- Speichert alles in `.weave/config.json`
- Generiert alle Files: CLAUDE.md/Rules, Agents, Skills, Commands, Teams
- Alles personalisiert auf den User + das Projekt

### 3. Agent-Teams & Subagent-Orchestrierung (Kernfeature)
**Was es tut:**
Weave definiert nicht nur einzelne Agents sondern ganze **Teams** die zusammenarbeiten.

**Konzept:**
- Jedes Team hat eine Aufgabe (z.B. "Feature Development", "Bug Fixing", "Code Review")
- Ein Team besteht aus mehreren Subagents mit klaren Rollen
- Es gibt Übergabe-Protokolle: wer gibt was an wen weiter
- Routing-Logik: Welches Team/Agent wird wann aktiviert

**Beispiel-Team "Feature Development":**
```
Orchestrator
├── Researcher    → Analysiert Codebase, findet relevanten Context
├── Planner       → Erstellt Implementation-Plan
├── Executor      → Schreibt den Code
├── Reviewer      → Prüft den Code auf Qualität
└── Tester        → Schreibt/Runt Tests
```

**Was Weave hier generiert:**
- Agent-Definitionen (Markdown) mit Rolle, Fähigkeiten, Einschränkungen
- Team-Definitionen mit Zusammensetzung und Routing
- Commands die Teams aktivieren (z.B. `/weave:build-feature`)

### 4. Evolve — Background-Optimierung
**Was es tut:**
Ein Hook der im Hintergrund mitläuft und das Setup kontinuierlich verbessert.

**Wie:**
- Hook läuft bei Tool-Calls mit
- Sammelt Daten: Was funktioniert? Was wird oft gemacht? Wo gibt's Friction?
- Periodisch (oder via `/weave:evolve`): Optimizer-Agent analysiert und schlägt Verbesserungen vor
- Kann automatisch neue Skills/Agents erstellen wenn Patterns erkannt werden
- Updated Rules wenn sich das Projekt verändert (neuer Tech-Stack, neue Conventions)

**Beispiele:**
- "Du commitest oft mit ähnlichen Messages → hier ist ein Commit-Skill dafür"
- "Dein Projekt hat jetzt Tests → hier sind Testing-Rules und ein Test-Agent"
- "Du nutzt immer die gleiche API-Struktur → hier ist ein API-Endpoint-Generator"

### 5. Sync (`/weave:sync`)
**Was es tut:**
Übersetzt Weave's universelles Format in die Configs aller installierten AI-Tools.

**Flow:**
```
.weave/ (Source of Truth)
    ↓ sync
┌───┴───┬────────┐
↓       ↓        ↓
.claude/ .cursor/ codex/
```

**Wann:**
- Manuell via `/weave:sync`
- Automatisch nach Onboarding
- Automatisch nach Evolve-Updates

### 6. Weitere Commands
- `/weave:add-agent` — Neuen Agent zum Workflow hinzufügen
- `/weave:add-skill` — Neuen Skill erstellen
- `/weave:add-team` — Neues Agent-Team definieren
- `/weave:status` — Zeigt aktuellen Weave-Status, installierte Agents/Skills/Teams

---

## Platform-Support

### Phase 1 (Start)
- Claude Code (Hauptfokus)

### Phase 2
- Cursor
- Codex

### Phase 3
- Windsurf
- Andere (community-driven)

### Adapter-Konzept
Jeder Adapter ist ein Markdown-File das beschreibt:
- Wo Config-Files hin müssen
- Welches Format Rules/Commands haben
- Welche Features die Platform unterstützt (Hooks? Agents? MCP?)
- Wie Weave's universelle Definitionen übersetzt werden

---

## .weave/ — Weave's eigener State

```
.weave/
├── config.json          # Onboarding-Ergebnisse (User + Projekt)
├── agents/              # Agent-Definitionen (universell)
├── skills/              # Skill-Definitionen (universell)
├── teams/               # Team-Definitionen
├── rules/               # Rules (universell)
├── history/             # Was wurde wann geändert (Evolve-Log)
└── platforms.json       # Welche Plattformen aktiv sind
```

---

## Tech-Stack
- **TypeScript** für den Installer
- **Markdown** für alles andere (Commands, Agents, Master-Instructions, Adapters)
- **JavaScript** für Hooks
- **npm** als Distribution (`npx weave`)
- Minimale Dependencies

---

## Build-Reihenfolge

### Schritt 1 — Fundament ✅
- [x] Repo-Setup (package.json, tsconfig, git)
- [x] Installer mit ASCII-Banner + Platform-Detection
- [x] `.weave/` Ordner-Struktur

### Schritt 2 — Onboarding ✅
- [x] Onboarding-Agent (Markdown) — mit Conversation-Führung, Phasen, ASCII-Banner
- [x] Master-Instructions (Basis-Set) — 6 Files: agents, subagents, teams, skills, rules, context-management
- [x] Generator-Logik im Onboarding-Command — detaillierte Anweisungen für alle Outputs
- [x] Output: CLAUDE.md + Agents + Rules + Teams + Skills + Config

### Schritt 3 — Agent-Teams ✅
- [x] Team-Schema definieren (core/schema.md)
- [x] Master-Instructions für Teams/Subagents
- [x] Architect-Agent der Teams designed
- [x] Team-Definitionen werden vom Onboarding generiert (projektspezifisch, keine generischen Beispiele)

### Schritt 4 — Evolve ✅
- [x] Evolve-Hook (Background-Monitoring) — hooks/evolve-hook.js
- [x] Context-Guard Hook — hooks/context-guard.js
- [x] Optimizer-Agent — agents/optimizer-agent.md
- [x] `/weave:evolve` Command

### Schritt 5 — Multi-Platform ✅
- [x] Adapter-System (Markdown-basiert)
- [x] Claude Code Adapter
- [x] Cursor-Adapter
- [x] Codex-Adapter
- [x] Windsurf-Adapter
- [x] `/weave:sync` Command
- [x] Sync-Agent

### Schritt 6 — Polish & Release
- [ ] README mit GIFs/Screenshots
- [ ] npm publish
- [ ] GitHub Release
- [ ] Git Repo initialisieren

---

## Offene Fragen
- Naming: `npx weave` oder `npx weave-ai`? (npm Name-Verfügbarkeit prüfen)
- Soll Evolve automatisch Änderungen machen oder immer erst vorschlagen?
- Wie detailliert soll das Onboarding sein? (Balance zwischen gründlich und nervig)
- Soll es ein `/weave:reset` geben um komplett von vorne anzufangen?
- Braucht es ein `/weave:export` um sein Setup zu teilen?
