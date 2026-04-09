import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  if (code) {
    // OAuth flow
    await supabase.auth.exchangeCodeForSession(code);
  } else if (token_hash && type) {
    // Magic Link flow
    await supabase.auth.verifyOtp({ token_hash, type: type as any });
  }

  return NextResponse.redirect(origin);
}
