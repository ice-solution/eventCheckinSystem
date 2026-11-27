# Design

<!-- impeccable:design-schema 1 -->

## World

Best Dressed Awards — neon cyber stage. Voting surfaces defer to client KVs (violet/magenta voids, cyan/gold frames). UI chrome stays thin so the uploaded art leads.

## Surfaces

### Public ballot `/votes/:eventId`
- Email gate: glass panel on void gradient; RSVP-only.
- Ballot: full KV with equal horizontal slot hits + chip fallback; 3-step stepper; submit only when all answered.
- Type: Orbitron (titles) + Rajdhani (UI).
- Motion: single rise entrance on gate/KV; selection glow on slots.

### Admin `/votes/:eventId/admin`
- Operate pattern inside existing admin shell.
- Three question cards: KV upload, title, slot count/labels.
- Static tallies only (refresh to update).

## Tokens (ballot)

- Void `#07041a`, violet `#6d28d9`, magenta `#c026d3`, cyan `#22d3ee`, gold `#fde047`, ink `#f5f3ff`.
- Primary CTA: gold→cyan gradient pill.

## Assets

- Reference KVs: `public/votes/img/ref-team.jpg`, `ref-king.jpg`, `ref-queen.jpg` (shipping copies of client Best Dressed art for local reference; production uses admin uploads).
