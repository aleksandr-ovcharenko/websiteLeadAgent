-- Hard-failed website viability: a discovered URL that cannot be loaded
-- (DNS/protocol/TLS/timeout) must not keep flowing through qualification.
ALTER TYPE "LeadWebsiteStatus" ADD VALUE IF NOT EXISTS 'FAILED';
