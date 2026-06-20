'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is already logged in, redirect them immediately
  useEffect(() => {
    async function checkCurrentSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check onboarding status
        const { data: business } = await supabase
          .from('businesses')
          .select('is_onboarded')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (business && business.is_onboarded) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }
    }
    checkCurrentSession();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Check onboarding state
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .select('is_onboarded')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (bizError) {
        setError('Failed to fetch business configuration.');
        setLoading(false);
        return;
      }

      if (business && business.is_onboarded) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Left Pane (Desktop Showcase) */}
      <div className="showcase-pane" style={{
        flex: 1.2,
        background: 'var(--showcase-bg)',
        borderRight: '1px solid var(--border-subtle)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        overflow: 'hidden',
      }}>
        {/* Glow Effects */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '-20%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Top Header */}
        <div className="nav-brand" style={{ fontSize: '22px' }}>
          <Image src="/logo.png" alt="Nexus Dunning" width={130} height={34} style={{ objectFit: 'contain' }} priority />
        </div>

        {/* Content Showcase */}
        <div style={{ maxWidth: '480px', margin: 'auto 0' }}>
          <h2 style={{
            fontSize: '38px',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-1.5px',
            marginBottom: '20px',
            background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent'
          }}>
            Automated Payment Recovery.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '32px' }}>
            Nexus handles failed SaaS subscriptions automatically. When Paystack charges fail, we trigger custom WhatsApp messages, Slack notifications, and smart email sequences to retrieve your revenue without manual interference.
          </p>

          {/* Flow Visualizer Widget */}
          <div className="glass-card" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AUTOMATION PATHWAY
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 6px #f43f5e' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Failed payment webhook received</span>
              </div>
              <div style={{ width: '2px', height: '12px', background: 'var(--border-subtle)', marginLeft: '3px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Supabase record logged & scheduled</span>
              </div>
              <div style={{ width: '2px', height: '12px', background: 'var(--border-subtle)', marginLeft: '3px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Email + WhatsApp notification sequence fired</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Secure Payment Recovery Sequence System.
        </div>
      </div>

      {/* Right Pane (Form Card Container) */}
      <div className="login-form-pane">
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '28px' }}>
            Sign in to manage your payment recovery sequences.
          </p>

          <form onSubmit={handleLogin}>
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: '24px' }}>
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ padding: '14px' }}
            >
              {loading ? 'Signing in...' : 'Sign in to account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
