import { httpGet, type PageQuery } from '@core/http/http.client';
import { MAX_LIMIT } from '@shared/models/sandbox.model';
import type { BusinessActivity } from '@shared/models/business-activity.model';

/** Reads the business-activity taxonomy. Mirrors `GET /api/sandbox/business-activities`. */

const RESOURCE = 'business-activities';

export function findBusinessActivities(query?: PageQuery): Promise<BusinessActivity[]> {
    return httpGet<BusinessActivity[]>(RESOURCE, query);
}

/**
 * The whole taxonomy. This is the largest of the reference collections, so the
 * paging loop matters here more than elsewhere: a single default-limit call
 * would silently return the first 50 rows and look complete.
 */
export async function findAllBusinessActivities(): Promise<BusinessActivity[]> {
    const all: BusinessActivity[] = [];

    for (let offset = 0; ; offset += MAX_LIMIT) {
        const page = await findBusinessActivities({ offset, limit: MAX_LIMIT });
        all.push(...page);
        if (page.length < MAX_LIMIT) return all;
    }
}
