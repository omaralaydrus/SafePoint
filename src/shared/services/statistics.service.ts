import { httpGet } from '@core/http/http.client';
import type { Statistics } from '@shared/models/statistics.model';

/**
 * Reads live operational counts. Mirrors `GET /api/sandbox/statistics` — a
 * single object, no paging.
 */
export function findStatistics(): Promise<Statistics> {
    return httpGet<Statistics>('statistics');
}
