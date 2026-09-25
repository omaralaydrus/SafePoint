import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import 'leaflet/dist/leaflet.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'SafePoint — Help is closer than you think',
  description: 'Find nearby hospitals, police stations, fire stations and pharmacies in Malaysia. Quickly call 999 and share your location with someone you trust.',
  applicationName: 'SafePoint', icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#d92d3e', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
