# Phoenix Claw — UI Test Cases (Manual)

UI-focused test cases for the complete dashboard: branding, shell, components, every page, responsive, theme, empty/error states, and accessibility. Run manually in a browser alongside [TEST_SUITES.md](../TEST_SUITES.md) using [MASTER_MANUAL_RUN.md](MASTER_MANUAL_RUN.md).

---

## Preconditions

- [ ] App running locally (e.g. `http://localhost:3000`)
- [ ] API running (e.g. `http://localhost:8011`) if testing data-dependent flows
- [ ] Test user logged in (e.g. `test@phoenix.io` / `testpassword123` or create via Register)
- [ ] Browser: Chrome or Firefox recommended

---

## U01 Branding

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U01.1 | Favicon in tab | Open any app URL, check browser tab | Phoenix icon (red phoenix) visible in tab | [ ] |
| U01.2 | Tab title | Check browser tab title | "Phoenix Claw" (no "Phoenix v2") | [ ] |
| U01.3 | Logo on login | Open `/login` | Red phoenix logo image visible above form | [ ] |
| U01.4 | Logo on register | Open `/register` | Same red phoenix logo visible | [ ] |
| U01.5 | Logo in sidebar | After login, check top-left of sidebar | Phoenix logo + "Phoenix Claw" text | [ ] |
| U01.6 | No "Phoenix v2" text | Search all visible pages (login, sidebar, headers) | No occurrence of "Phoenix v2" | [ ] |

---

## U02 Shell & Navigation

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U02.1 | Sidebar sections | After login, inspect sidebar | Sections: Trading, Analytics, Agents, System (with labels) | [ ] |
| U02.2 | Trading section items | Check Trading section | Trades, Daily Signals, 0DTE SPX, Positions | [ ] |
| U02.3 | Analytics section items | Check Analytics section | On-Chain, Macro-Pulse, Narrative, Risk, Performance, Market | [ ] |
| U02.4 | Agents section items | Check Agents section | Agents, Strategies, Skills, Network | [ ] |
| U02.5 | System section items | Check System section | Connectors, Tasks, Admin, Settings | [ ] |
| U02.6 | Active state (left border) | Click Trades, then Agents | Active item has left amber border + highlight | [ ] |
| U02.7 | Theme toggle | Click Dark/Light in sidebar | Theme changes; cards/borders update | [ ] |
| U02.8 | Logout visible | Check sidebar bottom | Logout button and user email visible | [ ] |
| U02.9 | Mobile bottom nav | Resize to 375px width | Bottom nav with 5 items (e.g. Trades, Agents, Tasks, Perf, More) | [ ] |
| U02.10 | Mobile active pill | On mobile, tap Trades then Agents | Active item has amber/pill highlight | [ ] |
| U02.11 | Sidebar hidden on mobile | At 375px width | Sidebar not visible; content full width | [ ] |

---

## U03 Page Headers

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U03.1 | Trades page header | Go to `/trades` | Icon in gradient circle + "Trades" title + description line | [ ] |
| U03.2 | Agents page header | Go to `/agents` | Icon + "Agents" + description | [ ] |
| U03.3 | Tasks page header | Go to `/tasks` | Icon + "Tasks" + description | [ ] |
| U03.4 | Performance page header | Go to `/performance` | Icon + "Performance" + description | [ ] |
| U03.5 | Settings page header | Go to `/settings` | Icon + "Settings" + description | [ ] |

---

## U04 Global Components

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U04.1 | Card style | View any page with cards (e.g. Trades metric cards) | Cards have rounded corners, subtle border, no flat white block | [ ] |
| U04.2 | Primary/gradient button | On Login, check Sign in button | Gradient or solid primary style; hover effect | [ ] |
| U04.3 | Input focus | Focus any text input (e.g. Filter on Trades) | Visible focus ring (e.g. amber); no invisible focus | [ ] |
| U04.4 | Dialog overlay | Open Create Task on `/tasks` | Backdrop blurred or semi-transparent; no solid black overlap | [ ] |
| U04.5 | Dialog content visible | With Create Task open | Form and title fully visible; dialog rounded | [ ] |
| U04.6 | Select dropdown | Open "All statuses" or "Assign Agent Role" dropdown on Tasks | Options visible; text not cut off or overlapping | [ ] |
| U04.7 | Tabs pill style | On Performance or Settings, check tab bar | Tabs have pill/rounded style; active tab distinct | [ ] |
| U04.8 | Badge/status | View agent or task with status | Status badge has color (e.g. success/warning) and readable text | [ ] |

---

## U05 Forms & Dialogs

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U05.1 | Create Task open | Go to `/tasks`, click Create Task | Dialog opens with Title, Description, Agent Role, Priority | [ ] |
| U05.2 | Create Task cancel | Open Create Task, click X or outside | Dialog closes; no stuck overlay | [ ] |
| U05.3 | Create Task submit | Fill title, optional description, select role/priority, Create | Task created or error shown; dialog closes on success | [ ] |
| U05.4 | Add Connector open | Go to `/connectors`, click Add Connector | Dialog opens with Name, Type, API key fields | [ ] |
| U05.5 | Add Connector close | Open Add Connector, close | Dialog closes; no black overlay left | [ ] |
| U05.6 | New Agent wizard step 1 | Go to `/agents`, click New Agent | Dialog shows step 1: name, type, description | [ ] |
| U05.7 | New Agent wizard next | Complete step 1, Next | Step 2 (Instance) visible | [ ] |
| U05.8 | All dialogs close cleanly | Open and close Create Task, Add Connector, New Agent | No overlay or scroll lock left after close | [ ] |

---

## U06 All Pages Load

For each route: navigate to URL; page renders; header and at least one main content area (table, cards, kanban, chart, or empty state) visible.

| ID | Route | Steps | Expected | Pass |
|----|-------|--------|----------|------|
| U06.1 | `/trades` | Go to `/trades` | Page header + metric cards + table or empty state | [ ] |
| U06.2 | `/positions` | Go to `/positions` | Page header + summary + open/closed tabs or table | [ ] |
| U06.3 | `/performance` | Go to `/performance` | Page header + tabs + charts or summary | [ ] |
| U06.4 | `/agents` | Go to `/agents` | Page header + agent cards or empty state | [ ] |
| U06.5 | `/strategies` | Go to `/strategies` | Page header + strategy cards or empty state | [ ] |
| U06.6 | `/connectors` | Go to `/connectors` | Page header + connector list or empty + Add button | [ ] |
| U06.7 | `/skills` | Go to `/skills` | Page header + Skill Catalog / Agent Config tabs | [ ] |
| U06.8 | `/market` | Go to `/market` | Page header + indices/chart/placeholders or grid | [ ] |
| U06.9 | `/daily-signals` | Go to `/daily-signals` | Page header + pipeline or metrics | [ ] |
| U06.10 | `/zero-dte` | Go to `/zero-dte` | Page header + SPX/0DTE sections | [ ] |
| U06.11 | `/onchain-flow` | Go to `/onchain-flow` | Page header + metrics and content | [ ] |
| U06.12 | `/macro-pulse` | Go to `/macro-pulse` | Page header + regime/tabs content | [ ] |
| U06.13 | `/narrative` | Go to `/narrative` | Page header + sentiment/metrics | [ ] |
| U06.14 | `/risk` | Go to `/risk` | Page header + risk/compliance content | [ ] |
| U06.15 | `/network` | Go to `/network` | Page header + graph or instance cards | [ ] |
| U06.16 | `/tasks` | Go to `/tasks` | Page header + Kanban columns + agent sidebar (desktop) | [ ] |
| U06.17 | `/admin` | Go to `/admin` | Page header + Users/API keys/Audit tabs | [ ] |
| U06.18 | `/settings` | Go to `/settings` | Page header + Profile/Theme/Notifications/API tabs | [ ] |
| U06.19 | `/agent-learning` | Go to `/agent-learning` | Page header + learning sessions or empty state | [ ] |
| U06.20 | `/dev` | Go to `/dev` | Page header + Dev Agent status / incidents | [ ] |

---

## U07 Responsive

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U07.1 | Desktop 1280px | Set viewport to 1280×720, open `/trades` | Sidebar visible; content fills right; no horizontal scroll | [ ] |
| U07.2 | Tablet 768px | Set viewport to 768px width | Sidebar visible or collapsed per design; content readable | [ ] |
| U07.3 | Mobile 375px | Set viewport to 375×667 | Bottom nav visible; sidebar hidden; content full width; readable | [ ] |
| U07.4 | No horizontal scroll (desktop) | At 1280px, open Trades, Agents, Tasks | No horizontal scrollbar | [ ] |
| U07.5 | No horizontal scroll (mobile) | At 375px, open same pages | No horizontal scrollbar | [ ] |

---

## U08 Theme

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U08.1 | Dark mode toggle | Click Dark in sidebar | Background and cards switch to dark theme | [ ] |
| U08.2 | Dark mode cards | In dark mode, view Trades or Agents | Cards have glass/subtle border; not bright white | [ ] |
| U08.3 | Light mode toggle | Click Light in sidebar | Theme reverts to light | [ ] |

---

## U09 Empty & Error States

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U09.1 | Empty strategies | Go to `/strategies` with no data | Empty state message + Create Strategy CTA | [ ] |
| U09.2 | Empty trades table | Go to `/trades` with no trades | "No trades yet" or similar message in table area | [ ] |
| U09.3 | Invalid route | Open `/invalid-route` or `/foo/bar` | Redirect to `/` or 404 page; no blank crash | [ ] |
| U09.4 | API error (optional) | Stop API, refresh dashboard or trigger a request | Error message or retry; no uncaught exception | [ ] |

---

## U10 Accessibility

| ID | Description | Steps | Expected | Pass |
|----|-------------|--------|----------|------|
| U10.1 | Login form tab order | On `/login`, Tab through fields | Focus moves Email → Password → Sign in; focus visible | [ ] |
| U10.2 | Form labels | On login, check Email and Password | Labels present and associated (click label focuses input) | [ ] |
| U10.3 | Dialog focus | Open Create Task, Tab | Focus stays within dialog (focus trap) or Esc closes | [ ] |
| U10.4 | Button focus visible | Focus any button (keyboard or click) | Visible focus ring or outline | [ ] |

---

## Summary

- **U01 Branding:** 6 cases  
- **U02 Shell & navigation:** 11 cases  
- **U03 Page headers:** 5 cases  
- **U04 Global components:** 8 cases  
- **U05 Forms & dialogs:** 8 cases  
- **U06 All pages load:** 20 cases  
- **U07 Responsive:** 5 cases  
- **U08 Theme:** 3 cases  
- **U09 Empty & error:** 4 cases  
- **U10 Accessibility:** 4 cases  

**Total UI test cases:** 74  

**Sign-off:** _________________ Date: _______
