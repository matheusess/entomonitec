'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';

export default function HomePage() {
  const { user, isLoading, getDefaultRoute } = useAuth();
  const router = useRouter();
  console.log('teste')
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Redirecionar baseado no papel do usuário
        const defaultRoute = getDefaultRoute(user.role);
        router.push(defaultRoute);
      } else {
        router.push('/login');
      }
    }
  }, [user, isLoading, router, getDefaultRoute]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null; // Will redirect
}
