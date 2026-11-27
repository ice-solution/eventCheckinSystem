# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Voters:** Event guests who already appear on that event’s RSVP list; they identify themselves with their registered email.
- **Admins / staff:** Event operators who configure Best Dressed voting and review tallies after voting closes or at any time.

## Product Purpose

Event Check-in System’s **voting** module lets guests cast awards-style votes (e.g. Best Dressed Team / King / Queen) during an event. Success means every eligible guest can finish a clear three-question ballot, and admins can see accurate static results without live polling load.

## Positioning

Votes are gated to **RSVP emails only**, presented as **three KV-led questions** (key visual already shows the nominees), and submitted as **one complete ballot**—not a generic open poll.

## Operating Context

- Runs inside the existing Event Check-in System (Express + EJS + MongoDB) on branch `phoebe_version`.
- Public path under `/votes/:eventId`; admin under `/votes/:eventId/admin` with existing `votes` permission.
- KVs supplied by the client (Best Dressed Team / King / Queen style banners with baked-in nominee slots).

## Capabilities and Constraints

- Email login required; email must match an RSVP user on that event.
- Admin uploads **exactly three questions’ KVs**; each question is a vote against slots/positions on that KV (option B: nominees are in the image; voters pick a slot/number).
- Voters must answer **all three questions**, then submit once.
- Admin results page is **static** (no live Socket/polling) to reduce server load.
- Open: exact slot count per question is configurable per question (Team ~3, King/Queen ~5 as in supplied art).

## Brand Commitments

- Visual direction follows the supplied Best Dressed Awards KVs (neon / cyber stage). Paths: project assets `BestDressedAwards-01/02/03` (Queen / King / Team).
- Product name remains Event Check-in System; award titles come from admin-configured question titles / KV art.

## Evidence on Hand

- KV references: Best Dressed Team (3 slots), Best Dressed King (5), Best Dressed Queen (5).
- Existing vote module (single poll, RSVP `userId`, max 5 options) is the functional baseline to replace for this redesign.

## Product Principles

1. **Eligible only** — no anonymous or off-list votes.
2. **KV is the ballot** — the uploaded art carries the nominees; UI selects slots, not separate portrait cards.
3. **One complete submission** — three answers, one commit.
4. **Light admin** — static tallies over live dashboards.
5. **Event-scoped** — every vote belongs to a single event’s RSVP universe.
