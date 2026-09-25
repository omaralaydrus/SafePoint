'use client';
import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@store/index';
export function Providers({ children }: { children: ReactNode }) {
  const store = useRef<AppStore | null>(null);
  store.current ??= makeStore();
  return <Provider store={store.current}>{children}</Provider>;
}
