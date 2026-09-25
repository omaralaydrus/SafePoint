import { httpGet, type PageQuery } from '@core/http/http.client';
import type { Zone } from '@shared/models/zone.model';

/**
 * Reads the council's administrative zones from the sandbox.
 * Counterpart of an Angular `@Injectable({providedIn: 'root'})` reference
 * service: one class-free module of thin transport calls, no state.
 */

const RESOURCE = 'zones';

/** One page of zones. Mirrors `GET /api/sandbox/zones`. */
export function findZones(query?: PageQuery): Promise<Zone[]> {
    return httpGet<Zone[]>(RESOURCE, query);
}

/**
 * Every zone, paging until the sandbox returns a short page.
 *
 * The spec's paging contract is "page until a call returns fewer rows than
 * `limit`" — there is no total count to rely on, so this is the only correct
 * termination condition. `limit` is held at the documented 200 clamp so a full
 * read costs the fewest calls against the rate-limit budget.
 */
export async function findAllZones(): Promise<Zone[]> {
    const limit = 200;
    const all: Zone[] = [];

    for (let offset = 0; ; offset += limit) {
        const page = await findZones({ offset, limit });
        all.push(...page);
        if (page.length < limit) return all;
    }
}
