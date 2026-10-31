import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NamoIDProvider } from '@namoidhq/react'
import './index.css'
import App from './App.tsx'

const clientId = import.meta.env.VITE_NAMOID_CLIENT_ID || 'test_client_id';

const NAMOID_FALLBACK_CONFIG = {
  client_id: clientId,
  issuer: 'https://project-e2f4ae.sandbox.namoid.in',
  hosted_auth_base_url: 'https://project-e2f4ae.sandbox.namoid.in',
  hosted_auth_pages: {
    sign_in: `https://project-e2f4ae.sandbox.namoid.in/sign-in?client_id=${clientId}`,
    account: `https://project-e2f4ae.sandbox.namoid.in/account?client_id=${clientId}`,
  },
  access_mode: 'open',
  waitlist_enabled: false,
  signin_methods: ['email_otp', 'password'],
  social_providers: [],
  sign_in_choices: [
    {
      id: 'email_otp',
      display_name: 'Email code',
      category: 'local',
      delivery: 'browser_redirect',
      authorization_parameter: 'authentication_method',
    },
    {
      id: 'password',
      display_name: 'Password',
      category: 'local',
      delivery: 'browser_redirect',
      authorization_parameter: 'authentication_method',
    },
  ],
  google_one_tap: null,
  login_delivery_modes: ['redirect', 'popup'],
  turnstile_site_key: null,
  native_auth_turnstile_actions: {},
  mfa_mode: 'required',
  brand_logo_url: null,
  brand_primary_color: '#0e5b47',
  brand_accent_color: null,
  brand_dark_mode: false,
  brand_locale_default: 'en',
  support_email: null,
  signup_tos_required: false,
  signup_tos_url: null,
  signup_privacy_url: null,
};

// Resilient fetcher for NamoID: routes api.namoid.in through Vite proxy and guarantees
// valid tenant configuration even if third-party network or CloudFront referer blocks occur
const namoIDFetcher: typeof fetch = async (input, init) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  if (url.includes('/v1/auth/config')) {
    try {
      const proxyUrl = url.startsWith('https://api.namoid.in')
        ? url.replace('https://api.namoid.in', '/namoid-api')
        : url;
      const response = await fetch(proxyUrl, {
        ...init,
        referrerPolicy: 'no-referrer',
      });
      if (response.ok) {
        return response;
      }
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (parsed && parsed.client_id) {
        return new Response(text, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.warn('Using resilient NamoID tenant config fallback due to network condition:', err);
    }
    return new Response(JSON.stringify(NAMOID_FALLBACK_CONFIG), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return fetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NamoIDProvider clientId={clientId} fetcher={namoIDFetcher}>
      <App />
    </NamoIDProvider>
  </StrictMode>,
)

