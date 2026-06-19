'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Session } from '@supabase/supabase-js';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  LogOut, 
  Percent, 
  AlertTriangle, 
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';

interface PaymentEvent {
  id: string;
  customer_email: string;
  amount: number;
  currency: string;
  failure_reason: string;
  retry_count: number;
  is_resolved: boolean;
  created_at: string;
}

interface Business {
  id: string;
  user_id: string;
  business_name: string;
  email: string;
  is_onboarded: boolean;
  paystack_secret_key?: string;
  billing_portal_url?: string;
  whatsapp_phone_id?: string;
  whatsapp_access_token?: string;
  slack_webhook_url?: string;
  created_at?: string;
  updated_at?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const activeTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' || 'dark';
    setTimeout(() => {
      setTheme(activeTheme);
    }, 0);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const loadBusinessAndEvents = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Business
      const { data: biz, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (bizError || !biz) {
        setError('Could not load your business settings. Please complete onboarding.');
        setLoading(false);
        return;
      }

      setBusiness(biz);

      // If business exists but they somehow bypassed onboarding is_onboarded field
      if (!biz.is_onboarded) {
        router.replace('/onboarding');
        return;
      }

      // 2. Fetch Payment Events
      const { data: paymentEvents, error: eventsError } = await supabase
        .from('payment_events')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) {
        console.error('Events fetch failed:', eventsError);
        setError('Failed to load payment logs.');
      } else {
        setEvents(paymentEvents || []);
      }

    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Validate session on load
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setSession(session);
      loadBusinessAndEvents(session.user.id);
    }
    checkSession();
  }, [router, loadBusinessAndEvents]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  // Format currency
  function formatAmount(amount: number, currency: string) {
    const value = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  }

  // Copy webhook URL to clipboard
  function copyWebhook(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Calculations for stats
  const totalFailed = events.length;
  const totalRecovered = events.filter(e => e.is_resolved).length;
  const activeSequences = events.filter(e => !e.is_resolved).length;
  const recoveryRate = totalFailed > 0 ? Math.round((totalRecovered / totalFailed) * 100) : 0;

  // Webhook URL (Dynamic template based on business token)
  const webhookUrl = business 
    ? `https://n8n.benjamin-nnaemeka.dev/webhook-test/paystack/charge-failed?token=${business.id}`
    : '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Translucent Pinned Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <Image src="/logo.png" alt="Nexus Dunning" width={120} height={32} style={{ objectFit: 'contain' }} priority />
        </div>
        <div className="nav-right">
          {session && <span className="nav-email">{session.user.email}</span>}
          
          <button 
            className="btn btn-ghost" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '8px', 
              borderRadius: '50%', 
              width: '36px', 
              height: '36px' 
            }}
          >
            {theme === 'dark' ? <Sun size={17} style={{ color: '#f59e0b' }} /> : <Moon size={17} />}
          </button>

          <button className="btn btn-ghost" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="container fade-in">
        
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Payment Recovery Dashboard</h1>
            <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Logged as: <strong style={{ color: 'var(--text-primary)' }}>{business?.business_name || 'Loading Business...'}</strong>
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => session && loadBusinessAndEvents(session.user.id)} 
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh data
          </button>
        </div>

        {/* Errors display */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '24px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Webhook Copier block */}
        {business && (
          <div className="webhook-box fade-in">
            <div className="webhook-title">
              <CheckCircle2 size={16} />
              Your Paystack Webhook URL
            </div>
            <p className="webhook-desc">
              Paste this URL in your Paystack Dashboard under Settings → API Keys & Webhooks → Webhook URL to route failed events.
            </p>
            <div className="webhook-row">
              <input type="text" value={webhookUrl} readOnly style={{ fontFamily: 'var(--font-mono)' }} />
              <button 
                className={`btn ${copied ? 'btn-secondary' : 'btn-primary'}`} 
                onClick={() => copyWebhook(webhookUrl)}
                style={{ minWidth: '110px', height: '42px' }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="stats-grid">
          
          {/* Stat 1 */}
          <div className="stat-card">
            <div className="stat-label">
              <XCircle size={16} style={{ color: 'var(--error)' }} />
              Total Failed Payments
            </div>
            <div className="stat-value">{loading ? '—' : totalFailed}</div>
            <div className="stat-sub">Failed transactions received</div>
            {/* Sparkline Visual SVG */}
            <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', pointerEvents: 'none' }}>
              <path 
                d="M0,25 Q40,20 80,24 T160,15 T240,22 T320,10 L320,30 L0,30 Z" 
                fill="rgba(244, 63, 94, 0.03)" 
                stroke="rgba(244, 63, 94, 0.15)" 
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Stat 2 */}
          <div className="stat-card">
            <div className="stat-label">
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              Recovered Payments
            </div>
            <div className="stat-value">{loading ? '—' : totalRecovered}</div>
            <div className="stat-sub">Sequences successfully resolved</div>
            <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', pointerEvents: 'none' }}>
              <path 
                d="M0,25 Q40,15 80,24 T160,10 T240,12 T320,5 L320,30 L0,30 Z" 
                fill="rgba(16, 185, 129, 0.03)" 
                stroke="rgba(16, 185, 129, 0.15)" 
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Stat 3 */}
          <div className="stat-card">
            <div className="stat-label">
              <Percent size={16} style={{ color: 'var(--accent)' }} />
              Recovery Rate
            </div>
            <div className="stat-value">{loading ? '—' : `${recoveryRate}%`}</div>
            <div className="stat-sub">Recovered / Total ratio</div>
            <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', pointerEvents: 'none' }}>
              <path 
                d="M0,28 Q40,20 80,18 T160,12 T240,8 T320,4 L320,30 L0,30 Z" 
                fill="rgba(99, 102, 241, 0.04)" 
                stroke="rgba(99, 102, 241, 0.2)" 
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Stat 4 */}
          <div className="stat-card">
            <div className="stat-label">
              <Clock size={16} style={{ color: 'var(--pending)' }} />
              Active Sequences
            </div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loading ? '—' : activeSequences}
              {!loading && activeSequences > 0 && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--pending)',
                  boxShadow: '0 0 8px var(--pending)',
                  animation: 'pulse 1.8s infinite ease-in-out'
                }} />
              )}
            </div>
            <div className="stat-sub">Sequences in progress</div>
            <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', pointerEvents: 'none' }}>
              <path 
                d="M0,20 Q40,25 80,21 T160,24 T240,18 T320,22 L320,30 L0,30 Z" 
                fill="rgba(245, 158, 11, 0.02)" 
                stroke="rgba(245, 158, 11, 0.12)" 
                strokeWidth="1.5"
              />
            </svg>
          </div>

        </div>

        {/* Events Table Container */}
        <div className="table-container fade-in">
          <div className="table-header-row">
            <h2 className="table-title">Recent Payment Events</h2>
            {!loading && <span className="table-count">{events.length} records</span>}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Retries</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton loader - matches structure of real rows to prevent layout shifting
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="skeleton-circle skeleton-shimmer" />
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '120px' }} />
                      </td>
                      <td>
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '70px' }} />
                      </td>
                      <td>
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '140px' }} />
                      </td>
                      <td>
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '30px' }} />
                      </td>
                      <td>
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '85px', borderRadius: '9999px', height: '22px' }} />
                      </td>
                      <td>
                        <div className="skeleton-bar skeleton-shimmer" style={{ width: '110px' }} />
                      </td>
                    </tr>
                  ))
                ) : events.length === 0 ? (
                  // Empty state
                  <tr>
                    <td colSpan={6} className="table-state-cell" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <Database size={40} style={{ marginBottom: '16px' }} />
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                          No failed payments registered
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Actual logs
                  events.map((e) => (
                    <tr key={e.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: 'none' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          fontWeight: 600
                        }}>
                          {e.customer_email.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.customer_email}</span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatAmount(e.amount, e.currency)}</strong>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {e.failure_reason || 'Declined / Insufficient funds'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {e.retry_count ?? 0} / 3
                      </td>
                      <td>
                        {e.is_resolved ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={11} />
                            Recovered
                          </span>
                        ) : (
                          <span className="badge badge-pending">
                            <Clock size={11} />
                            In Progress
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                        {new Date(e.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Subtle Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px 40px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        Nexus Recovery Engine &copy; {new Date().getFullYear()} — Automated Payment Recovery.
      </footer>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
