'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import Layout from '@/components/Layout';
import RegistroGeografico from '@/components/pages/RegistroGeografico';

export default function RegistroGeograficoPage() {
  const { isLoading, isAuthorized } = useAuthGuard({
    requiredRoles: ['supervisor', 'administrator'],
    requireOrganization: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <Layout>
      <RegistroGeografico />
    </Layout>
  );
}
