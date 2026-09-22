import type { PrismaClient } from '@prisma/client';
import { canonicalizeWebsite } from '../../../collector/src/utils/canonicalizeWebsite.js';

// Radar deduplication — safe, deterministic, auditable.
//
// "Remove duplicates" = one actionable Lead per real company website while
// preserving discovery evidence and downstream work. Nothing is hard-deleted:
// merged rows keep mergeStatus=MERGED + mergedIntoLeadId, blocked groups are
// reported for human resolution.

export interface LeadLite {
  id: string;
  companyName: string;
  website: string | null;
  websiteDomain: string | null;
  phone: string | null;
  address: string | null;
  emailDomain?: string | null;
  source: string;
  sourceId: string;
  city?: string | null;
  categories?: string[];
  redesignStage: string;
  manualReviewStatus: string;
  mergeStatus: string;
  createdAt: Date;
  hasSite: boolean;
  hasActiveRuns?: boolean;
}

export interface DupMember {
  leadId: string;
  companyName: string;
  matchedKey: string;
}

export interface DupGroup {
  key: string;
  kind: 'DOMAIN' | 'PHONE_NAME' | 'EMAIL_NAME' | 'NAME_ADDRESS_PHONE';
  members: DupMember[];
  survivorId: string | null;
  mergeIds: string[];
  blocked: boolean;
  blockReason?: string;
}

const normName = (s: string) =>
  s.toLowerCase()
    .replace(/[«»"'`]/g, ' ')
    .replace(/\b(оао|ооо|зао|чао|уп|чтуп|чуп|ип|гуп|рдуп|llc|ltd|inc|gmbh)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normPhone = (s?: string | null) => (s || '').replace(/\D/g, '').replace(/^80/, '375');

function emailDomain(website?: string | null, explicit?: string | null): string | null {
  if (explicit) return explicit.toLowerCase();
  return null;
}

function sameOrg(a: LeadLite, b: LeadLite): boolean {
  const na = normName(a.companyName);
  const nb = normName(b.companyName);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Token-set containment: "студия дизайна елены кожеуровой" is the same org as
  // "студия дизайна интерьера елены кожеуровой" even though the shorter form is
  // not a contiguous substring. A single shared word (e.g. "минск") is never
  // enough — the shorter name must contribute ≥2 distinctive tokens.
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size < 2) return na.includes(nb) || nb.includes(na);
  return [...small].every((t) => big.has(t));
}

/** Deterministic survivor: site artifact > reviewed > data completeness > oldest. */
export function chooseSurvivor(members: LeadLite[]): LeadLite {
  const completeness = (l: LeadLite) =>
    (l.phone ? 1 : 0) + (l.address ? 1 : 0) + (l.website ? 1 : 0) + ((l.categories?.length ?? 0) > 0 ? 1 : 0);
  // GOOD > UNSURE > UNREVIEWED > BAD — a human-rejected record should never
  // survive over a human-approved twin.
  const reviewed = (l: LeadLite) =>
    ({ GOOD: 3, UNSURE: 2, UNREVIEWED: 1, BAD: 0 } as Record<string, number>)[l.manualReviewStatus] ?? 1;
  return [...members].sort((a, b) =>
    (b.hasSite ? 1 : 0) - (a.hasSite ? 1 : 0)
    || reviewed(b) - reviewed(a)
    || completeness(b) - completeness(a)
    || a.createdAt.getTime() - b.createdAt.getTime()
    || a.id.localeCompare(b.id),
  )[0];
}

/** Group leads by strong duplicate keys. Weak same-name matches never merge. */
export function groupDuplicates(leads: LeadLite[]): DupGroup[] {
  const groups: DupGroup[] = [];
  const byDomain = new Map<string, LeadLite[]>();
  for (const l of leads) {
    const cw = canonicalizeWebsite(l.website || l.websiteDomain);
    const key = cw.domainKey || (l.websiteDomain ? canonicalizeWebsite(`https://${l.websiteDomain}`).domainKey : null);
    if (key) (byDomain.get(key) || byDomain.set(key, []).get(key)!).push(l);
  }
  for (const [key, members] of byDomain) {
    if (members.length > 1) {
      groups.push({ key, kind: 'DOMAIN', members: members.map((m) => ({ leadId: m.id, companyName: m.companyName, matchedKey: key })), survivorId: null, mergeIds: [], blocked: false });
    }
  }

  // Phone + org-name key (only for leads not already grouped by domain).
  const grouped = new Set(groups.flatMap((g) => g.members.map((m) => m.leadId)));
  const byPhone = new Map<string, LeadLite[]>();
  for (const l of leads) {
    if (grouped.has(l.id)) continue;
    const p = normPhone(l.phone);
    if (p && p.length >= 9) (byPhone.get(p) || byPhone.set(p, []).get(p)!).push(l);
  }
  for (const [phone, members] of byPhone) {
    const orgMatch = members.filter((m) => members.some((o) => o !== m && sameOrg(m, o)));
    if (orgMatch.length > 1) {
      groups.push({
        key: `phone:${phone}`,
        kind: 'PHONE_NAME',
        members: orgMatch.map((m) => ({ leadId: m.id, companyName: m.companyName, matchedKey: phone })),
        survivorId: null, mergeIds: [], blocked: false,
      });
    }
  }
  return groups;
}

/** Decide the merge plan for a group. Groups with conflicting downstream
 *  artifacts are blocked — never auto-merged. */
export function planMerge(group: DupGroup, members: LeadLite[]): DupGroup {
  const withSites = members.filter((m) => m.hasSite);
  const withRuns = members.filter((m) => m.hasActiveRuns);

  if (withSites.length > 1) {
    group.blocked = true;
    group.blockReason = 'CONFLICTING_GENERATED_SITES';
    // Provisional primary keeps the domain slot occupied; non-primaries are
    // marked BLOCKED (not merged) so humans resolve which artifact survives.
    const primary = chooseSurvivor(members);
    group.survivorId = primary.id;
    group.mergeIds = members.filter((m) => m.id !== primary.id).map((m) => m.id);
    return group;
  }
  if (withRuns.length > 1) {
    group.blocked = true;
    group.blockReason = 'MULTIPLE_ACTIVE_FACTORY_RUNS';
    const primary = chooseSurvivor(members);
    group.survivorId = primary.id;
    group.mergeIds = members.filter((m) => m.id !== primary.id).map((m) => m.id);
    return group;
  }

  // Different organisations sharing one domain (e.g. two tenants of a venue
  // site) — same domain does not prove same company.
  const distinctOrgs = new Set(members.map((m) => normName(m.companyName)));
  // Every member must have at least one OTHER member it recognizably matches —
  // otherwise the domain is shared by different organisations (e.g. separate
  // services listed on one venue site) and merging would combine strangers.
  const orgOverlap = members.every((m) => members.some((o) => o !== m && sameOrg(m, o)));
  if (distinctOrgs.size > 1 && !orgOverlap) {
    group.blocked = true;
    group.blockReason = 'DIFFERENT_ORGANISATIONS_SAME_DOMAIN';
    // No defensible owner — every member is blocked for human review, none is
    // repointed or archived into a survivor.
    group.survivorId = null;
    group.mergeIds = members.map((m) => m.id);
    return group;
  }

  const survivor = chooseSurvivor(members);
  group.survivorId = survivor.id;
  group.mergeIds = members.filter((m) => m.id !== survivor.id).map((m) => m.id);
  return group;
}

/** Transactional merge: repoint relationships to the survivor, mark merged
 *  rows recoverably, never hard-delete evidence. */
export async function applyMerge(
  tx: any,
  group: DupGroup,
  opts: { blocked?: boolean } = {},
): Promise<{ merged: string[]; survivor: string | null }> {
  if (!group.mergeIds.length) return { merged: [], survivor: group.survivorId };
  const status = opts.blocked ? 'BLOCKED_FOR_MANUAL_MERGE' : 'MERGED';

  // No survivor (DIFFERENT_ORGANISATIONS_SAME_DOMAIN): just block every member
  // for manual review — nothing is repointed or combined.
  if (!group.survivorId) {
    for (const id of group.mergeIds) {
      await tx.lead.update({
        where: { id },
        data: { mergeStatus: status, mergedIntoLeadId: null, duplicateGroupKey: group.key, archivedAt: new Date() },
      });
    }
    return { merged: [], survivor: null };
  }

  for (const id of group.mergeIds) {
    const src = await tx.lead.findUnique({ where: { id }, select: { categories: true, phone: true, address: true } });
    // Repoint provenance relationships. LeadQuery is unique per (leadId,
    // query) — drop rows that would collide on the survivor, then move rest.
    const srcQueries = await tx.leadQuery.findMany({ where: { leadId: id }, select: { id: true, query: true } });
    const survivorQueries = new Set(
      (await tx.leadQuery.findMany({ where: { leadId: group.survivorId }, select: { query: true } })).map((q: { query: string }) => q.query),
    );
    const colliding = srcQueries.filter((q: { query: string }) => survivorQueries.has(q.query)).map((q: { id: string }) => q.id);
    if (colliding.length) await tx.leadQuery.deleteMany({ where: { id: { in: colliding } } });
    await tx.leadQuery.updateMany({ where: { leadId: id }, data: { leadId: group.survivorId } });
    await tx.discoveryCandidate.updateMany({ where: { leadId: id }, data: { leadId: group.survivorId } });
    // Merge compatible scalar fields into the survivor (never overwrite real data).
    const survivor = await tx.lead.findUnique({ where: { id: group.survivorId }, select: { categories: true, phone: true, address: true } });
    const mergedCategories = [...new Set([...(survivor?.categories || []), ...(src?.categories || [])])];
    await tx.lead.update({
      where: { id: group.survivorId },
      data: {
        categories: mergedCategories,
        phone: survivor?.phone || src?.phone || null,
        address: survivor?.address || src?.address || null,
      },
    });
    await tx.lead.update({
      where: { id },
      data: {
        mergeStatus: status,
        mergedIntoLeadId: group.survivorId,
        duplicateGroupKey: group.key,
        archivedAt: new Date(),
      },
    });
  }
  await tx.lead.update({ where: { id: group.survivorId }, data: { duplicateGroupKey: group.key } });
  return { merged: group.mergeIds, survivor: group.survivorId };
}

export { normName as normalizeOrgName, normPhone as normalizePhone, sameOrg, emailDomain };
