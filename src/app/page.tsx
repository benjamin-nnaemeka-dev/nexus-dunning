'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/login');
          return;
        }

        // Fetch is_onboarded state from businesses table
        const { data: business, error } = await supabase
          .from('businesses')
          .select('is_onboarded')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking onboarding status:', error);
          router.replace('/login');
          return;
        }

        if (business && business.is_onboarded) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        router.replace('/login');
      }
    }

    checkAuth();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-page)',
      color: '#a1a1aa',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle top glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '25vw',
        width: '50vw',
        height: '40vh',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0) 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(255, 255, 255, 0.05)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px auto'
        }} />
        
        <p style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '-0.1px' }}>
          Verifying secure session...
        </p>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
