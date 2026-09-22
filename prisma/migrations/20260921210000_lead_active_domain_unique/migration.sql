-- One active Lead per canonical website domain. Merged, blocked and archived
-- records are exempt so history stays inspectable without breaking uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_active_websiteDomain_key"
  ON "Lead" ("websiteDomain")
  WHERE "mergeStatus" = 'NONE' AND "archivedAt" IS NULL AND "websiteDomain" IS NOT NULL;
