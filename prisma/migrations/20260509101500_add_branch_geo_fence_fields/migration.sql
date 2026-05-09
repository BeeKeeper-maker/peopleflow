-- Add geo-fencing fields expected by the current Branch model.
-- Safe for production: additive nullable columns plus a defaulted integer column.
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geoFenceRadius" INTEGER NOT NULL DEFAULT 200;
