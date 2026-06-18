'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        const friendlyErrors: { [key: string]: string } = {
          'User already registered': 'An account with this email already exists.',
          'Password should be at least 6 characters': 'Password must be at least 6 characters.',
          'Unable to validate email address: invalid format': 'Please enter a valid email address.'
        };
        setError(friendlyErrors[signUpError.message] || signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Failed to create account. Please try again.');
        setLoading(false);
        return;
      }

      // Create profile in businesses table
      const { error: insertError } = await supabase
        .from('businesses')
        .insert({
          user_id: data.user.id,
          business_name: businessName,
          email: email,
          is_onboarded: false
        });

      if (insertError) {
        console.error('Business insert failed:', insertError);
        // Let's sign them out to clear any partial session
        await supabase.auth.signOut();
        setError('Failed to configure business profile. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => {
        router.push('/onboarding');
      }, 1500);

    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Left Pane (Showcase) */}
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
            Never lose a customer to card expiration, insufficient funds, or gateway errors again. Connect your billing flow, customize your alerts, and let our engine retrieve your revenue dynamically.
          </p>

          <div className="glass-card" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Why SaaS founders choose Nexus
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Instant setup in under 5 minutes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Resend Email + WhatsApp integrations</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Real-time event tracking and statistics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Secure Payment Recovery Sequence System.
        </div>
      </div>

      {/* Right Pane (Signup Card) */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
        position: 'relative'
      }}>
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Get started
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '28px' }}>
            Create your account to start recovering failed payments.
          </p>

          <form onSubmit={handleSignup}>
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <Check size={16} />
                <span>{success}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="businessName">Business name</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Inc."
                  disabled={loading}
                />
              </div>
            </div>

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
                  placeholder="At least 6 characters"
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
              {loading ? 'Creating account...' : 'Create free account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .showcase-pane {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
