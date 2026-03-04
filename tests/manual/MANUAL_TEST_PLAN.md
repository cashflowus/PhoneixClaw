# Phoenix v2 Manual Test Plan

Manual browser test checklist for regression and UAT. Run with app deployed locally (e.g. `http://localhost:80` or `http://localhost:3000`).

---

## Preconditions

- [ ] App running locally (Docker Compose or `npm run dev` + API)
- [ ] Test user: `test@phoenix.io` / `testpassword123` (or create via register)
- [ ] Browser: Chrome and/or Firefox

---

## 1. Login & Auth

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M01 | Login page renders | Open `/login` | Email, Password, Sign in visible | [ ] |
| M02 | Empty submit shows validation | Click Sign in with empty fields | Validation or error message | [ ] |
| M03 | Invalid credentials show error | Enter wrong email/password, Sign in | Error message, stay on login | [ ] |
| M04 | Valid login redirects to dashboard | Enter valid creds, Sign in | Redirect to `/trades` or `/` | [ ] |
| M05 | Logout clears session | After login, click Logout/Sign out | Redirect to login, token cleared | [ ] |

---

## 2. Navigation

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M06 | Sidebar shows all nav items | After login, check sidebar | Trades, Positions, Performance, Agents, etc. | [ ] |
| M07 | Click Trades navigates | Click Trades in nav | URL contains `/trades` | [ ] |
| M08 | Click Positions navigates | Click Positions | URL contains `/positions` | [ ] |
| M09 | Click Agents navigates | Click Agents | URL contains `/agents` | [ ] |
| M10 | Mobile: bottom nav or hamburger | Resize to 375px, check nav | Bottom nav or menu visible | [ ] |

---

## 3. Trades Page

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M11 | Trades page loads | Go to `/trades` | Heading "Trades", stats or table | [ ] |
| M12 | Trades table or empty state | View trades list | Table or "No trades" message | [ ] |
| M13 | Trade row click opens detail | Click a trade row (if any) | Side panel or modal with details | [ ] |
| M14 | Filter by status | Use status filter if present | List updates | [ ] |

---

## 4. Positions Page

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M15 | Positions page loads | Go to `/positions` | Heading, summary cards | [ ] |
| M16 | Open positions list | View open positions | List or empty state | [ ] |
| M17 | Closed tab or section | Switch to Closed | Closed positions or empty | [ ] |
| M18 | Close position (if open pos) | Click Close on a position | Modal with exit price/reason | [ ] |

---

## 5. Agents Page

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M19 | Agents page loads | Go to `/agents` | Agent cards or empty state | [ ] |
| M20 | New Agent opens wizard | Click New Agent | Dialog with step 1 (name/type) | [ ] |
| M21 | Wizard step 2: Instance | Next to step 2 | Instance dropdown visible | [ ] |
| M22 | Wizard step 3: Skills | Next to step 3 | Skills selection | [ ] |
| M23 | Wizard step 4: Risk config | Next to step 4 | Risk sliders/inputs | [ ] |
| M24 | Wizard step 5: Review & Create | Next to step 5, Create | Agent created or error | [ ] |
| M25 | Approve/Promote on agent card | If CREATED agent, click Approve | Status changes | [ ] |
| M26 | Pause/Resume agent | Pause then Resume | Status toggles | [ ] |

---

## 6. Other Core Pages (Load Check)

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| M27 | Connectors page | Go to `/connectors` | Page loads, no console errors | [ ] |
| M28 | Skills page | Go to `/skills` | Page loads | [ ] |
| M29 | Market page | Go to `/market` | Indices, chart, news visible | [ ] |
| M30 | Tasks page | Go to `/tasks` | Kanban columns visible | [ ] |
| M31 | Admin page | Go to `/admin` | Users/roles/audit section | [ ] |
| M32 | Settings page | Go to `/settings` | Form or sections visible | [ ] |
| M33 | Daily Signals | Go to `/daily-signals` | Pipeline or feed visible | [ ] |
| M34 | 0DTE SPX | Go to `/zero-dte` | Gamma/MOC sections | [ ] |
| M35 | Macro-Pulse | Go to `/macro-pulse` | Page loads | [ ] |
| M36 | On-Chain Flow | Go to `/onchain-flow` | Page loads | [ ] |
| M37 | Narrative | Go to `/narrative` | Page loads | [ ] |
| M38 | Risk & Compliance | Go to `/risk` | Page loads | [ ] |
| M39 | Network | Go to `/network` | Graph or topology | [ ] |
| M40 | Dev Dashboard | Go to `/dev` | Page loads | [ ] |

---

## Responsive & Theme

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| R01 | Desktop 1280x720 | Resize to 1280x720 | Layout correct, no overflow | [ ] |
| R02 | Mobile 375x667 | Resize to 375x667 | Bottom nav or menu, readable | [ ] |
| R03 | Theme toggle (if present) | Switch theme | Colors update | [ ] |

---

## Error States

| ID | Description | Steps | Expected | Pass |
|----|--------------|-------|----------|------|
| E01 | API down: graceful message | Stop API, refresh dashboard | Error message or retry | [ ] |
| E02 | 404 or invalid route | Open `/invalid-route` | Redirect or 404 page | [ ] |

---

**Total manual tests:** 40+ (core) + 3 (responsive) + 2 (error).  
**Sign-off:** _________________ Date: _______
