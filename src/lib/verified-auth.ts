import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase as clientSupabase } from '@/integrations/supabase/client';

type VerifiedAuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: { sub: string; email?: string; role?: string; [key: string]: unknown };
};

export const requireSupabaseAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    // When invoked from the browser, fetch the active session access token
    let token: string | undefined;
    try {
      const { data } = await clientSupabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      void 0;
    }

    if (!token && typeof window !== 'undefined') {
      try {
        const stored =
          localStorage.getItem('sb-placeholder-auth-token') ||
          localStorage.getItem('sb-placeholder-key-auth-token');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.access_token;
        }
      } catch {
        void 0;
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  })
  .server<VerifiedAuthContext>(async ({ next }) => {
    const url =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const header = getRequest().headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!url || !key) {
      throw new Error('Sign-in service is not configured.');
    }

    if (!header.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Please sign in to continue.');
    }

    if (!token) {
      throw new Error('Unauthorized: Session token is missing.');
    }

    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      // Fallback: try getUser with the token
      const userRes = await supabase.auth.getUser(token);
      if (userRes.error || !userRes.data?.user?.id) {
        throw new Error('Unauthorized: Session has expired. Please sign in again.');
      }
      const user = userRes.data.user;
      return next({
        context: {
          supabase,
          userId: user.id,
          claims: { sub: user.id, email: user.email, role: 'authenticated' },
        },
      });
    }

    return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
  });