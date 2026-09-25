import { test, expect, type Page } from '@playwright/test';

const places = [
  { id: 'node/1', name: 'Test Hospital', category: 'hospital', address: 'Test Street', lat: 3.155, lon: 101.697, distanceKm: .4, phone: '+60 3 1234 5678', emergency: 'yes', openingHours: '24/7' },
  { id: 'node/2', name: 'Test Police Station', category: 'police', address: 'Test Avenue', lat: 3.153, lon: 101.69, distanceKm: .6 },
  { id: 'node/3', name: 'Test Pharmacy', category: 'pharmacy', address: 'Test Road', lat: 3.15, lon: 101.7, distanceKm: .8 },
];
async function mockPlaces(page: Page) {
  await page.route('**/api/nearby?**', route => route.fulfill({ json: { places, source: 'OpenStreetMap', radiusKm: 5, fetchedAt: new Date().toISOString() } }));
}
test('emergency calls, filtering, saved places, contacts and map navigation', async ({ page }) => {
  await mockPlaces(page); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Help is closer than you think.' })).toBeVisible();
  await expect(page.locator('.hero-call')).toHaveAttribute('href', 'tel:999');
  await expect(page.locator('.location-description')).toContainText('Showing the city centre');
  await expect(page.locator('.place-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Hospitals', exact: true }).click();
  await expect(page.locator('.place-card')).toHaveCount(1);
  await expect(page.locator('.directions-button')).toHaveAttribute('href', /destination=3.155,101.697/);
  await page.getByRole('button', { name: 'Save Test Hospital', exact: true }).click();
  await page.getByRole('button', { name: 'Saved places' }).click();
  await expect(page.locator('.place-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Saved places' }).click();
  await expect(page.getByRole('button', { name: 'Test Hospital', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My emergency contacts' }).click();
  await page.getByRole('button', { name: 'Add your first contact' }).click();
  await page.getByLabel('Full name').fill('Test Contact'); await page.getByLabel('Phone number').fill('+60 12 345 6789');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByRole('link', { name: 'Call Test Contact' })).toHaveAttribute('href', 'tel:+60123456789');
  await page.reload(); await page.getByRole('button', { name: 'My emergency contacts' }).click();
  await expect(page.getByText('Test Contact', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Test Contact' }).click();
  await expect(page.getByRole('heading', { name: 'A familiar voice makes a difference.' })).toBeVisible();
});
test('location denial, manual area, and empty results remain usable', async ({ page, context }) => {
  await context.clearPermissions(); await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_success: unknown, error: (err: unknown) => void) => error({ code: 1 }) } });
  });
  await page.route('**/api/nearby?**', route => route.fulfill({ json: { places: [], source: 'OpenStreetMap', radiusKm: 5 } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.locator('.inline-alert')).toContainText('permission was denied');
  await page.getByRole('button', { name: 'Choose another location' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Shah Alam', exact: true }).click();
  await expect(page.locator('.location-card h2')).toHaveText('Shah Alam');
  await expect(page.getByRole('heading', { name: 'No matching places found' })).toBeVisible();
  await page.getByLabel('Search radius').selectOption('2');
  await page.getByRole('button', { name: 'Reset filters & widen search' }).click();
  await expect(page.getByLabel('Search radius')).toHaveValue('5');
});
test('fresh geolocation sharing and map selection', async ({ page, context }) => {
  await mockPlaces(page); await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: 3.2, longitude: 101.7 });
  await page.goto('/'); await page.getByRole('button', { name: 'Share my location' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Location message')).toHaveValue(/query=3.2,101.7/);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.location-card h2')).toHaveText('Your current location');
  await page.getByRole('button', { name: 'Test Hospital', exact: true }).click();
  await expect(page.locator('.leaflet-popup')).toContainText('Test Hospital');
});
test('service errors preserve calling and expose a retry and maps fallback', async ({ page }) => {
  await page.route('**/api/nearby?**', route => route.fulfill({ status: 503, json: { message: 'Service temporarily unavailable.' } }));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'We couldn’t load nearby places' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute('href', /google.com\/maps\/search/);
  await expect(page.locator('.hero-call')).toHaveAttribute('href', 'tel:999');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
test('council API paginates, filters zones and honours rate limiting', async ({ page }) => {
  await mockPlaces(page);
  const offsets: string[] = [];
  await page.route('**/api/sandbox/zones?**', route => {
    const offset = new URL(route.request().url()).searchParams.get('offset') || '0'; offsets.push(offset);
    return route.fulfill({ json: offset === '0' ? Array.from({ length: 200 }, (_, i) => ({ zoneCode: `Z${i}`, nameMs: `Zon ${i}`, nameEn: `Zone ${i}`, dunCode: 'D1', active: true })) : [{ zoneCode: 'Z200', nameMs: 'Zon Ujian', nameEn: 'Test Zone', dunCode: 'D1', active: true }] });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Local council' }).click();
  await expect(page.getByText('Connected to Rebana')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test Zone' })).toBeVisible();
  expect(offsets).toContain('200');
  await page.getByRole('textbox', { name: 'Search council zones' }).fill('not found');
  await expect(page.getByText('No zones match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Emergency overview' }).click();
  await page.route('**/api/sandbox/zones?**', route => route.fulfill({ status: 429, json: { message: 'Rate limited.', code: 'SANDBOX_RATE_LIMITED', retryAfterSeconds: 3 } }));
  await page.getByRole('button', { name: 'Local council' }).click();
  await expect(page.getByRole('button', { name: /Retry in/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled({ timeout: 6000 });
});
test('phone layout has no horizontal overflow, navigation and dialogs work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockPlaces(page); await page.goto('/');
  await expect(page.locator('.place-card')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'My emergency contacts' }).click();
  await page.getByRole('button', { name: 'Add your first contact' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('API routes reject malformed coordinates, unsupported radii and unapproved proxy paths', async ({ request }) => {
  for (const query of ['', '?lat=&lon=', '?lat=91&lon=101&radius=5', '?lat=3&lon=101&radius=4', '?lat=3;out&lon=101&radius=5']) {
    expect((await request.get(`/api/nearby${query}`)).status()).toBe(400);
  }
  expect((await request.get('/api/sandbox/admin')).status()).toBe(404);
  expect((await request.get('/api/sandbox/zones?offset=-1')).status()).toBe(400);
  expect((await request.get('/api/sandbox/zones?limit=0')).status()).toBe(400);
});
