'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    if (!supabase) {
      window.location.href = '/';
      return;
    }
    // Supabase JS client automatically handles the hash fragment from magic link
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        window.location.href = '/';
      }
    });
    // Fallback redirect after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-500">로그인 처리 중...</div>
    </div>
  );
}
