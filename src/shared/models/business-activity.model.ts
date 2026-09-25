/**
 * Mirrors `SandboxBusinessActivity` — one node of the council's three-tier
 * business-activity taxonomy, based on the national MDKT classification.
 *
 * The tier rule is the thing to get right: tier 1 and 2 are grouping headers
 * for guided pickers, and only tier-3 leaves (`selectable`) can actually be
 * declared on an application. A picker that lets a user choose a tier-2 row
 * produces an application the council cannot process.
 */
export interface BusinessActivity {
    /**
     * Stable unique code of the node — the key to use when correlating or
     * filtering. Display names may be reworded; codes never change.
     */
    code: string;

    /** Activity name in Malay (the council's working language). */
    name: string;

    /** Activity name in English. May be null when no translation is maintained. */
    nameEn: string | null;

    /** 1 = top-level category, 2 = subcategory, 3 = leaf activity. */
    tier: number;

    /** True only for tier-3 leaves — the activities declarable on an application. */
    selectable: boolean;

    /** Whether the node is currently part of the taxonomy. */
    active: boolean;
}

/**
 * The spec exposes the taxonomy as a flat, name-ordered list with a `tier`
 * number and no parent pointer, so a parent/child tree cannot be reconstructed
 * from it. Grouping by tier is therefore the honest presentation — it shows the
 * shape of the taxonomy without inventing edges the API does not publish.
 */
export function groupByTier(activities: readonly BusinessActivity[]): { tier: number; activities: BusinessActivity[] }[] {
    const tiers = new Map<number, BusinessActivity[]>();
    for (const activity of activities) {
        const bucket = tiers.get(activity.tier);
        if (bucket) bucket.push(activity);
        else tiers.set(activity.tier, [activity]);
    }
    return [...tiers.entries()]
        .map(([tier, list]) => ({ tier, activities: list }))
        .sort((a, b) => a.tier - b.tier);
}

export const TIER_LABEL: Record<number, string> = {
    1: 'Category',
    2: 'Subcategory',
    3: 'Leaf activity',
};
