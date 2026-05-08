-- Phase 2 Design 2 — accent-insensitive search support.
-- Postgres unaccent extension lets the universal search match "meches"
-- against "Mèches" without the cashier typing the accent.

CREATE EXTENSION IF NOT EXISTS unaccent;
