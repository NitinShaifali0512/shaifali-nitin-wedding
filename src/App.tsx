import { Suspense, lazy } from 'react';
import { InvitationSite } from './site/InvitationSite';
import { Splash } from './site/Splash';

// The dashboard is loaded only when someone opens /admin, so guests never download it.
// The single-file preview build has no /admin address, so the dashboard is left out of it entirely.
const AdminApp = import.meta.env.MODE === 'artifact' ? null : lazy(() => import('./admin/AdminApp'));

export function isAdminRoute(pathname: string): boolean {
  return /\/admin(\/.*)?$/.test(pathname.replace(/\/+$/, ''));
}

export function App() {
  if (AdminApp && isAdminRoute(window.location.pathname)) {
    return (
      <Suspense fallback={<Splash text="Opening the dashboard" />}>
        <AdminApp />
      </Suspense>
    );
  }
  return <InvitationSite />;
}
