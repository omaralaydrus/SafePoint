import { httpGet, type PageQuery } from '@core/http/http.client';
import { MAX_LIMIT } from '@shared/models/sandbox.model';
import type { LicenseType } from '@shared/models/license-type.model';

/** Reads the license/permit type catalog. Mirrors `GET /api/sandbox/license-types`. */

const RESOURCE = 'license-types';

export function findLicenseTypes(query?: PageQuery): Promise<LicenseType[]> {
    return httpGet<LicenseType[]>(RESOURCE, query);
}

/** Every type, paged until a short page arrives. See `findAllZones` for the contract. */
export async function findAllLicenseTypes(): Promise<LicenseType[]> {
    const all: LicenseType[] = [];

    for (let offset = 0; ; offset += MAX_LIMIT) {
        const page = await findLicenseTypes({ offset, limit: MAX_LIMIT });
        all.push(...page);
        if (page.length < MAX_LIMIT) return all;
    }
}
