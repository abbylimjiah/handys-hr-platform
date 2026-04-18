import { createClient } from '@supabase/supabase-js';

// 🔒 환경변수에서만 읽음 — 키를 코드에 박지 말 것!
// NEXT_PUBLIC_* 접두사 env vars는 빌드 시 클라이언트 번들에 포함됨.
// .env.local(로컬) 또는 배포 환경변수(Vercel)에 설정.
// ⚠️ service_role 키 절대 금지 — 반드시 anon public 키만 사용!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase 환경변수 미설정. .env.local 확인 필요.');
}

// 🔓 Web Lock 비활성화 — 여러 요청이 동시 auth 호출 시 "lock stolen" 에러 방지
// (Supabase JS v2의 알려진 이슈: https://github.com/supabase/supabase-js/issues/936)
export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
});

// ─── Types ───
export type Branch = {
  id: number;
  branch_num: number;
  name: string;
  region: string;
  target_to: number;
  note: string;
};

export type Employee = {
  id: number;
  name: string;
  eng_name: string;
  email: string | null;
  branch_id: number | null;
  status: 'active' | 'hiring' | 'onboarding' | 'transfer' | 'leave' | 'resigning' | 'resigned';
  slot_number: number | null;
  is_hm: boolean;
  hire_date: string | null;
  resign_date: string | null;
  status_note: string;
  branch?: Branch;
};

export type UserRole = {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  name: string;
};

// ─── API Functions ───

// Branches
export async function getBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('region')
    .order('name');
  if (error) throw error;
  return data as Branch[];
}

export async function updateBranch(id: number, updates: Partial<Branch>) {
  const { data, error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Branch;
}

// Employees
export async function getEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*, branch:branches(*)')
    .order('name');
  if (error) throw error;
  return data as Employee[];
}

export async function getEmployeesByBranch(branchId: number) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('branch_id', branchId)
    .order('slot_number');
  if (error) throw error;
  return data as Employee[];
}

export async function createEmployee(emp: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .insert(emp)
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(id: number, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: number) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Status History
export async function addStatusHistory(entry: {
  employee_id: number;
  old_status?: string;
  new_status: string;
  old_branch_id?: number;
  new_branch_id?: number;
  changed_by: string;
  memo?: string;
}) {
  const { error } = await supabase
    .from('status_history')
    .insert(entry);
  if (error) throw error;
}

// Auth & Roles
export async function getUserRole(email: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('email', email)
    .single();
  if (error) return null;
  return data as UserRole;
}

export async function signInWithMagicLink(email: string) {
  if (!email.endsWith('@handys.co.kr')) {
    throw new Error('@handys.co.kr 이메일만 사용 가능합니다.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/handys-hr-platform/auth/callback/`,
    }
  });
  if (error) throw error;
}

// 비밀번호 로그인 (매직링크 rate limit 우회용 기본 방식)
export async function signInWithPassword(email: string, password: string) {
  if (!email.endsWith('@handys.co.kr')) {
    throw new Error('@handys.co.kr 이메일만 사용 가능합니다.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Board data (branches + employees combined)
export async function getBoardData() {
  const [branches, employees] = await Promise.all([
    getBranches(),
    getEmployees()
  ]);

  return branches.map(branch => ({
    ...branch,
    employees: employees.filter(e => e.branch_id === branch.id),
    hm: employees.find(e => e.branch_id === branch.id && e.is_hm)
  }));
}

// Summary stats
export async function getSummaryStats() {
  const branches = await getBranches();
  const employees = await getEmployees();

  const regions: Record<string, {
    branches: number; to: number; filled: number;
    hiring: number; onboarding: number; transfer: number; leave: number;
  }> = {};

  branches.forEach(b => {
    if (!regions[b.region]) regions[b.region] = { branches:0, to:0, filled:0, hiring:0, onboarding:0, transfer:0, leave:0 };
    regions[b.region].branches++;
    regions[b.region].to += b.target_to;
  });

  employees.forEach(e => {
    if (!e.branch_id) return;
    const branch = branches.find(b => b.id === e.branch_id);
    if (!branch) return;
    const r = regions[branch.region];
    if (!r) return;
    if (e.status !== 'resigned' && e.status !== 'hiring') r.filled++;
    if (e.status === 'hiring') r.hiring++;
    if (e.status === 'onboarding') r.onboarding++;
    if (e.status === 'transfer') r.transfer++;
    if (e.status === 'leave') r.leave++;
  });

  return regions;
}
