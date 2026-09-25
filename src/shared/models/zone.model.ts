/**
 * Mirrors `SandboxZone` in the sandbox OpenAPI spec.
 *
 * The spec's own field descriptions are reproduced here rather than summarised:
 * the sandbox contract is additive-only, so this file is a copy of a published
 * API's shape, not a convenience type. When the spec gains a field, add it;
 * never rename or drop one.
 */
export interface Zone {
    /**
     * Stable unique code of the zone — the value applications carry and the key
     * to use when correlating or filtering by zone. Codes never change; display
     * names may be reworded.
     */
    zoneCode: string;

    /** Zone display name in Malay (the council's working language). */
    nameMs: string;

    /** Zone display name in English. May be null when no translation is maintained. */
    nameEn: string | null;

    /**
     * Code of the parent DUN (Dewan Undangan Negeri — the state legislative
     * assembly constituency the zone sits inside). Groups zones one level up in
     * the Parliament > DUN > Zone hierarchy.
     */
    dunCode: string;

    /**
     * Whether the zone is currently in use. The list endpoint only returns
     * active zones, so this is always true today; it is in the shape so that
     * publishing inactive zones later is an additive change.
     */
    active: boolean;
}

/**
 * Groups zones by their parent DUN. Presentation-only: the API returns a flat
 * list ordered by `zoneCode`, and the hierarchy is implied by `dunCode`.
 */
export function groupByDun(zones: readonly Zone[]): { dunCode: string; zones: Zone[] }[] {
    const groups = new Map<string, Zone[]>();
    for (const zone of zones) {
        const bucket = groups.get(zone.dunCode);
        if (bucket) bucket.push(zone);
        else groups.set(zone.dunCode, [zone]);
    }
    return [...groups.entries()]
        .map(([dunCode, list]) => ({ dunCode, zones: list }))
        .sort((a, b) => a.dunCode.localeCompare(b.dunCode));
}
