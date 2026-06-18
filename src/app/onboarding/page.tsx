'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { CreditCard, MessageSquare, BellRing, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form states
  const [paystackKey, setPaystackKey] = useState('');
  const [billingUrl, setBillingUrl] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [slackUrl, setSlackUrl] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Validate session on load
  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setSession(session);
      
      // Prefill if they have existing partial data
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (business) {
        setPaystackKey(business.paystack_secret_key || '');
        setBillingUrl(business.billing_portal_url || '');
        setWhatsappPhoneId(business.whatsapp_phone_id || '');
        setWhatsappToken(business.whatsapp_access_token || '');
        setSlackUrl(business.slack_webhook_url || '');
        
        // If they are already onboarded, send them to dashboard
        if (business.is_onboarded) {
          router.replace('/dashboard');
          return;
        }
      }
      setCheckingAuth(false);
    }
    getSession();
  }, [router]);

  function nextStep() {
    setError('');
    if (step === 1) {
      if (!paystackKey.trim() || !billingUrl.trim()) {
        setError('Please fill in both your Paystack Secret Key and Billing Portal URL.');
        return;
      }
      if (!billingUrl.startsWith('http://') && !billingUrl.startsWith('https://')) {
        setError('Billing Portal URL must start with http:// or https://');
        return;
      }
    }
    setStep(prev => prev + 1);
  }

  function prevStep() {
    setError('');
    setStep(prev => prev - 1);
  }

  async function handleComplete() {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const updates = {
        paystack_secret_key: paystackKey.trim(),
        billing_portal_url: billingUrl.trim(),
        whatsapp_phone_id: whatsappPhoneId.trim(),
        whatsapp_access_token: whatsappToken.trim(),
        slack_webhook_url: slackUrl.trim(),
        is_onboarded: true,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('businesses')
        .update(updates)
        .eq('user_id', session.user.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err) {
      console.error(err);
      setError('Failed to update business configuration. Please try again.');
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-page)',
        color: '#a1a1aa'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255, 255, 255, 0.05)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px auto'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      position: 'relative'
    }}>
      {/* Top Background Radial Glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '25vw',
        width: '50vw',
        height: '40vh',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, rgba(99, 102, 241, 0) 70%)',
        pointerEvents: 'none'
      }} />

      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '560px', padding: '48px 40px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Configure Nexus Dunning
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '32px' }}>
          Connect your accounts and customize your retry webhooks to automate recovery.
        </p>

        {/* Stepper Header */}
        <div className="stepper">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-num">{step > 1 ? <Check size={14} /> : '1'}</div>
            <div className="step-label">Payments</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-num">{step > 2 ? <Check size={14} /> : '2'}</div>
            <div className="step-label">WhatsApp</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-num">3</div>
            <div className="step-label">Slack</div>
          </div>
        </div>

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

        {/* Step Contents */}
        {step === 1 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Payment Integration & Portal</h3>
            </div>

            <div className="field">
              <label htmlFor="paystackKey">Paystack Secret Key <span>*</span></label>
              <input
                type="password"
                id="paystackKey"
                value={paystackKey}
                onChange={(e) => setPaystackKey(e.target.value)}
                placeholder="sk_live_..."
              />
              <p className="hint">Found in your Paystack Dashboard → Settings → API Keys & Webhooks</p>
            </div>

            <div className="field">
              <label htmlFor="billingUrl">Billing Portal URL <span>*</span></label>
              <input
                type="url"
                id="billingUrl"
                value={billingUrl}
                onChange={(e) => setBillingUrl(e.target.value)}
                placeholder="https://billing.yourdomain.com"
              />
              <p className="hint">Where customers manage credit cards. Included as a button in recovery emails.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>WhatsApp Channel Settings <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></h3>
            </div>

            <div className="field">
              <label htmlFor="whatsappPhoneId">Meta Phone Number ID</label>
              <input
                type="text"
                id="whatsappPhoneId"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                placeholder="e.g. 10984920439..."
              />
            </div>

            <div className="field">
              <label htmlFor="whatsappToken">Meta Access Token</label>
              <input
                type="password"
                id="whatsappToken"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                placeholder="EAAW..."
              />
              <p className="hint">Generated in Meta Developer portal → WhatsApp API → API Setup</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <BellRing size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Slack Alert Channel <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></h3>
            </div>

            <div className="field" style={{ marginBottom: '32px' }}>
              <label htmlFor="slackUrl">Incoming Webhook URL</label>
              <input
                type="url"
                id="slackUrl"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
              />
              <p className="hint">Create an Incoming Webhook in Slack and paste the URL here to get instant alerts on failed and recovered charges.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '32px' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={prevStep} disabled={loading}>
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={nextStep} style={{ marginLeft: 'auto' }}>
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleComplete}
              disabled={loading}
              style={{ marginLeft: 'auto' }}
            >
              {loading ? 'Saving...' : 'Finish Setup'}
              {!loading && <Check size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
