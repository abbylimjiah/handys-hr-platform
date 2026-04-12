'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, signInWithMagicLink, signOut, getUserRole } from '@/lib/supabase';
import type { Branch, Employee, UserRole } from '@/lib/supabase';
import {
  Search, Plus, Edit3, Trash2, Users, BarChart3, LayoutGrid, Settings,
  ChevronDown, ChevronRight, X, Save, Filter, LogOut, Shield, Upload, MapPin, FileSpreadsheet, RefreshCw, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── 사원코드 헬퍼: status_note에 "역할|사원코드" 형태로 저장 ───
function parseNote(note: string): { role: string; code: string } {
  if (!note) return { role: '', code: '' };
  const parts = note.split('|');
  if (parts.length >= 2) return { role: parts[0], code: parts[1] };
  // 숫자만 있으면 사원코드
  if (/^\d+$/.test(note)) return { role: '', code: note };
  return { role: note, code: '' };
}
function buildNote(role: string, code: string): string {
  if (role && code) return `${role}|${code}`;
  if (role) return role;
  if (code) return code;
  return '';
}
function getRole(emp: { status_note: string; is_hm: boolean }): string {
  const { role } = parseNote(emp.status_note);
  if (role === '파트장') return '파트장';
  if (role === 'Lead') return 'Lead';
  if (emp.is_hm) return 'HM';
  return '매니저';
}
function getCode(emp: { status_note: string }): string {
  return parseNote(emp.status_note).code;
}
function isLeadRole(note: string): boolean {
  const { role } = parseNote(note);
  return role === 'Lead';
}
function isPartjangRole(note: string): boolean {
  const { role } = parseNote(note);
  return role === '파트장';
}

// ─── Main Page ───
export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('board');
  const [search, setSearch] = useState('');

  // Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    // service_role 키 사용 → 인증 불필요, RLS 우회
    setUser({ email: 'abby.lim@handys.co.kr' });
    setUserRole({ email: 'abby.lim@handys.co.kr', role: 'admin', name: 'Abby' });
    setLoading(false);
    return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        getUserRole(session.user.email).then(setUserRole);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        getUserRole(session.user.email).then(setUserRole);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    const [{ data: b }, { data: e }] = await Promise.all([
      supabase.from('branches').select('*').order('region').order('name'),
      supabase.from('employees').select('*, branch:branches(*)').order('name'),
    ]);
    if (b) setBranches(b);
    if (e) setEmployees(e);
  }, []);

  useEffect(() => {
    if (user && userRole) loadData();
  }, [user, userRole, loadData]);

  // Login screen states (must be before any early returns per Rules of Hooks)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const canEdit = userRole?.role === 'admin' || userRole?.role === 'editor';
  const isAdmin = userRole?.role === 'admin';

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-500">Loading...</div></div>;


  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithMagicLink(loginEmail);
      setLoginSent(true);
    } catch (err: any) {
      setLoginError(err.message || '로그인 요청에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-white">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">핸디즈 인사관리</h1>
          <p className="text-sm text-gray-500 mb-6">운영지원팀 전용 플랫폼</p>
          {loginSent ? (
            <div>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>
              </div>
              <p className="text-sm text-gray-700 font-medium mb-1">로그인 링크를 발송했습니다</p>
              <p className="text-xs text-gray-500 mb-4">{loginEmail} 받은편지함을 확인하세요</p>
              <button onClick={() => { setLoginSent(false); setLoginEmail(''); }} className="text-xs text-emerald-600 hover:underline">다른 이메일로 다시 시도</button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink}>
              <input
                type="email"
                placeholder="name@handys.co.kr"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
              {loginError && <p className="text-xs text-red-500 mb-2">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loginLoading ? '발송 중...' : '로그인 링크 받기'}
              </button>
            </form>
          )}
          <p className="text-xs text-gray-400 mt-4">@handys.co.kr 계정만 접근 가능</p>
        </div>
      </div>
    );
  }

  // No role assigned
  if (!userRole) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">접근 권한 없음</h2>
          <p className="text-sm text-gray-500 mb-4">관리자에게 권한을 요청하세요.<br/>{user.email}</p>
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-700 underline">로그아웃</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'board', label: '인원배치보드', icon: LayoutGrid },
    { id: 'roster', label: '인원리스트', icon: Users },
    { id: 'summary', label: '인원현황', icon: BarChart3 },
    ...(isAdmin ? [{ id: 'settings', label: '설정', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">핸디즈 인사관리</h1>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">운영지원팀</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" placeholder="이름, 지점 검색..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{userRole.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  userRole.role === 'admin' ? 'bg-red-100 text-red-700' :
                  userRole.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{userRole.role}</span>
                <button onClick={signOut} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-1 -mb-px">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  tab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-4">
        {tab === 'board' && <BoardView branches={branches} employees={employees} search={search} canEdit={canEdit} onRefresh={loadData} />}
        {tab === 'roster' && <RosterView branches={branches} employees={employees} search={search} canEdit={canEdit} onRefresh={loadData} />}
        {tab === 'summary' && <SummaryView branches={branches} employees={employees} />}
        {tab === 'settings' && isAdmin && <SettingsView branches={branches} />}
      </main>
    </div>
  );
}

// ─── Board View ───
function BoardView({ branches, employees, search, canEdit, onRefresh }: {
  branches: Branch[]; employees: Employee[]; search: string; canEdit: boolean; onRefresh: () => void;
}) {
  const [region, setRegion] = useState('전체');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ branch: Branch; slotNum: number; employee?: Employee } | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set()); // employee IDs
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const regions = ['전체', 'HQ', '강원', '경기', '부울경', '서울', '인천', '제주'];
  const regionOrder = ['HQ', '강원', '경기', '부울경', '서울', '인천', '제주'];

  const boardData = useMemo(() => {
    let filtered = branches;
    if (region !== '전체') filtered = filtered.filter(b => b.region === region);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b => {
        const branchEmps = employees.filter(e => e.branch_id === b.id);
        return b.name.toLowerCase().includes(q) ||
          branchEmps.some(e => e.eng_name.toLowerCase().includes(q) || e.name.includes(q));
      });
    }
    // Group by region
    // Group by region, ordered with HQ first
    const groups: Record<string, (Branch & { emps: Employee[]; hm?: Employee })[]> = {};
    regionOrder.forEach(r => { /* pre-seed order */ });
    filtered.forEach(b => {
      if (!groups[b.region]) groups[b.region] = [];
      const emps = employees.filter(e => e.branch_id === b.id && e.status !== 'resigned');
      const hm = emps.find(e => e.is_hm);
      // 일반 매니저만 입사일순 정렬 → 슬롯 재배정 (HM, 리드, 파트장 제외)
      if (b.region !== 'HQ') {
        const mgrs = emps.filter(e => !e.is_hm && !isLeadRole(e.status_note) && !isPartjangRole(e.status_note)).sort((a, b) => {
          const da = a.hire_date || '9999';
          const db = b.hire_date || '9999';
          return da.localeCompare(db);
        });
        mgrs.forEach((e, idx) => { (e as any).slot_number = idx + 1; });
      }
      groups[b.region].push({ ...b, emps, hm });
    });
    // Sort: HQ first, then alphabetical by regionOrder
    const sorted: Record<string, typeof groups[string]> = {};
    regionOrder.forEach(r => { if (groups[r]) sorted[r] = groups[r]; });
    Object.keys(groups).forEach(r => { if (!sorted[r]) sorted[r] = groups[r]; });
    return sorted;
  }, [branches, employees, region, search]);

  const stats = useMemo(() => {
    const totalTO = branches.reduce((s, b) => s + b.target_to, 0);
    const activeEmps = employees.filter(e => e.status !== 'resigned');
    const filled = activeEmps.length;
    const hiring = activeEmps.filter(e => e.status === 'hiring').length;
    return { totalTO, filled, hiring, vacancy: totalTO - filled };
  }, [branches, employees]);

  const handleSlotClick = (branch: Branch, slotNum: number) => {
    if (!canEdit) return;
    const emp = employees.find(e => e.branch_id === branch.id && e.slot_number === slotNum && e.status !== 'resigned');
    if (multiSelect && emp) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(emp.id)) next.delete(emp.id); else next.add(emp.id);
        return next;
      });
      return;
    }
    setModal({ branch, slotNum, employee: emp });
  };

  const handleHmClick = (branch: Branch & { hm?: Employee }) => {
    if (!canEdit) return;
    if (multiSelect && branch.hm) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(branch.hm!.id)) next.delete(branch.hm!.id); else next.add(branch.hm!.id);
        return next;
      });
      return;
    }
    setModal({ branch, slotNum: 0, employee: branch.hm });
  };

  const handleBulkRemove = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명을 슬롯에서 제거하시겠습니까?`)) return;
    setBulkRemoving(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('employees').update({
      branch_id: null, slot_number: null, is_hm: false
    }).in('id', ids);
    if (error) { alert('제거 실패: ' + error.message); }
    setBulkRemoving(false);
    setSelected(new Set());
    setMultiSelect(false);
    onRefresh();
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { l: '총 TO', v: stats.totalTO, c: 'text-gray-900' },
          { l: '현 인원', v: stats.filled, c: 'text-emerald-600' },
          { l: '채용필요', v: stats.hiring, c: 'text-red-600' },
          { l: '공석', v: stats.vacancy, c: 'text-amber-600' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">{s.l}</div>
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {regions.map(r => (
          <button key={r} onClick={() => setRegion(r)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
              region === r ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}>{r}</button>
        ))}
        <div className="ml-auto">
          <button onClick={() => { setMultiSelect(!multiSelect); setSelected(new Set()); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
              multiSelect ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}>{multiSelect ? '선택 취소' : '다중 선택'}</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[140px]">지점</th>
                <th className="text-center px-2 py-2.5 font-semibold w-16">HM</th>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <th key={n} className="text-center px-1 py-2.5 font-semibold text-gray-400 min-w-[105px]">{n}</th>
                ))}
                <th className="text-center px-2 py-2.5 font-semibold w-14">TO</th>
                <th className="text-center px-2 py-2.5 font-semibold w-14">현원</th>
                <th className="text-left px-3 py-2.5 font-semibold min-w-[180px]">비고</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(boardData).map(([rgn, items]) => {
                const rTO = items.reduce((s, b) => s + b.target_to, 0);
                const rFill = items.reduce((s, b) => s + b.emps.length, 0);

                /* ── HQ: 리드 슬롯 카드형 렌더링 ── */
                if (rgn === 'HQ') {
                  const hqBranch = items[0];
                  if (!hqBranch) return null;
                  const slotLabels = [
                    { label: 'HM리드', slotNum: 0, isHm: true },
                    { label: 'M1리드', slotNum: 1, isHm: false },
                    { label: 'M2리드', slotNum: 2, isHm: false },
                    { label: 'M3리드', slotNum: 3, isHm: false },
                    { label: 'M4리드', slotNum: 4, isHm: false },
                  ];
                  return (
                    <React.Fragment key={rgn}>
                      <tr className="bg-indigo-50 border-b">
                        <td colSpan={14} className="px-3 py-2">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="font-bold text-indigo-800">HQ</span>
                            <span className="text-xs text-indigo-600 bg-indigo-200 px-2 py-0.5 rounded-full">본부 리드</span>
                            <span className="text-xs text-gray-500 ml-2">TO {hqBranch.target_to} / 현원 {hqBranch.emps.length}</span>
                          </div>
                          <div className="flex gap-4 pb-2">
                            {slotLabels.map(slot => {
                              const emp = slot.isHm
                                ? hqBranch.emps.find(e => e.is_hm)
                                : hqBranch.emps.find(e => e.slot_number === slot.slotNum && !e.is_hm);
                              return (
                                <div key={slot.label} className="flex flex-col items-center gap-1.5 min-w-[120px]">
                                  <div className="text-xs font-semibold text-indigo-700">{slot.label}</div>
                                  {emp ? (
                                    <button onClick={() => handleSlotClick(hqBranch, slot.slotNum)}
                                      className="w-full px-3 py-2 bg-pink-50 border border-pink-300 rounded-xl text-center hover:shadow-md transition">
                                      <div className="text-sm font-bold text-pink-700">{emp.eng_name}</div>
                                      <div className="text-[10px] text-gray-500">{getRole(emp) === '매니저' ? '' : getRole(emp) === 'Lead' ? 'LEAD' : getRole(emp)}</div>
                                    </button>
                                  ) : (
                                    <button onClick={() => handleSlotClick(hqBranch, slot.slotNum)}
                                      className="w-full px-3 py-4 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-300 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center">
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                }

                /* ── 일반 지역: 기존 테이블 행 렌더링 ── */
                return (
                  <React.Fragment key={rgn}>
                    <tr className="bg-emerald-50 border-b cursor-pointer hover:bg-emerald-100 transition"
                      onClick={() => setCollapsed(p => ({ ...p, [rgn]: !p[rgn] }))}>
                      <td colSpan={14} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {collapsed[rgn] ? <ChevronRight className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
                          <span className="font-bold text-emerald-800">{rgn}</span>
                          <span className="text-xs text-emerald-600 bg-emerald-200 px-2 py-0.5 rounded-full">{items.length}개 지점</span>
                          <span className="text-xs text-gray-500 ml-2">TO {rTO} / 현원 {rFill}</span>
                        </div>
                      </td>
                    </tr>
                    {!collapsed[rgn] && items.map(br => {
                      const fill = br.emps.length;
                      return (
                        <tr key={br.id} className="border-b hover:bg-gray-50 transition">
                          <td className="px-3 py-2 sticky left-0 bg-white">
                            <div className="font-medium text-gray-900">{br.name}</div>
                            <div className="text-xs text-gray-400">#{br.branch_num}</div>
                          </td>
                          <td className="text-center px-1 py-1.5">
                            {br.hm ? (
                              <button onClick={() => handleHmClick(br)}
                                className={`w-full min-h-[44px] px-2 py-1.5 border rounded-xl text-center text-xs transition hover:shadow-lg hover:-translate-y-0.5 ${
                                  multiSelect && selected.has(br.hm!.id)
                                    ? 'bg-red-100 border-red-500 text-red-700 ring-2 ring-red-400'
                                    : 'bg-pink-50 border-pink-300 text-pink-700'
                                }`}>
                                {multiSelect && <div className="text-[10px] mb-0.5">{selected.has(br.hm!.id) ? '☑' : '☐'}</div>}
                                <div className="font-bold text-[13px]">{br.hm.eng_name}</div>
                                <div className="text-[10px] text-pink-500 mt-0.5">{br.hm.name}</div>
                              </button>
                            ) : (
                              <button onClick={() => handleHmClick(br)}
                                className="w-full h-11 border-2 border-dashed border-gray-200 rounded-xl text-gray-300 hover:border-pink-400 hover:text-pink-400 hover:bg-pink-50 transition flex items-center justify-center">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                          {[1,2,3,4,5,6,7,8,9].map(slotNum => {
                            const emp = br.emps.find(e => e.slot_number === slotNum);
                            return (
                              <td key={slotNum} className="px-1 py-1.5">
                                {emp ? (
                                  <button onClick={() => handleSlotClick(br, slotNum)}
                                    className={`w-full min-h-[44px] px-2 py-1.5 border rounded-xl text-center text-xs leading-tight transition hover:shadow-lg hover:-translate-y-0.5 ${
                                      multiSelect && selected.has(emp.id)
                                        ? 'bg-red-100 border-red-500 text-red-700 ring-2 ring-red-400' :
                                      emp.status === 'hiring' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
                                      emp.status === 'onboarding' ? 'bg-blue-50 border-blue-400 text-blue-800' :
                                      emp.status === 'transfer' ? 'bg-purple-50 border-purple-400 text-purple-800' :
                                      emp.status === 'leave' ? 'bg-green-50 border-green-400 text-green-800' :
                                      emp.status === 'resigning' ? 'bg-orange-50 border-orange-400 text-orange-800' :
                                      isLeadRole(emp.status_note) ? 'bg-amber-50 border-amber-300 text-amber-800' :
                                      'bg-emerald-50 border-emerald-200 text-gray-800'
                                    }`}>
                                    {multiSelect && <div className="text-[10px] mb-0.5">{selected.has(emp.id) ? '☑' : '☐'}</div>}
                                    <div className="font-bold text-[13px]">{emp.eng_name}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">{emp.name}</div>
                                    {(() => {
                                      const label =
                                        emp.status === 'leave' ? '육아휴직중' :
                                        emp.status === 'resigning' && emp.resign_date ? `퇴사예정 ${emp.resign_date.slice(5)}` :
                                        emp.status === 'resigning' ? '퇴사예정' :
                                        emp.status === 'onboarding' ? '입사대기' :
                                        emp.status === 'transfer' ? '이동예정' :
                                        '';
                                      return label ? <div className="text-[9px] text-gray-400 mt-0.5">{label}</div> : null;
                                    })()}
                                  </button>
                                ) : (
                                  <button onClick={() => handleSlotClick(br, slotNum)}
                                    className="w-full h-11 border-2 border-dashed border-gray-200 rounded-xl text-gray-300 hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-50 transition flex items-center justify-center">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-2 py-2 font-bold text-gray-700">{br.target_to}</td>
                          <td className="text-center px-2 py-2">
                            <span className={`font-bold ${fill >= br.target_to ? 'text-emerald-600' : 'text-red-600'}`}>{fill}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[200px]">{br.note}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-select floating bar */}
      {multiSelect && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selected.size}명 선택</span>
          <button onClick={handleBulkRemove} disabled={bulkRemoving}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />{bulkRemoving ? '제거 중...' : '일괄 제거'}
          </button>
          <button onClick={() => { setSelected(new Set()); setMultiSelect(false); }}
            className="px-3 py-2 text-sm text-gray-300 hover:text-white">취소</button>
        </div>
      )}

      {/* Slot Modal */}
      {modal && (
        <SlotModal
          branch={modal.branch} slotNum={modal.slotNum} employee={modal.employee}
          isHmSlot={modal.slotNum === 0}
          employees={employees} onClose={() => setModal(null)} onSaved={() => { setModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function SlotModal({ branch, slotNum, employee, isHmSlot, employees, onClose, onSaved }: {
  branch: Branch; slotNum: number; employee?: Employee; isHmSlot?: boolean;
  employees: Employee[]; onClose: () => void; onSaved: () => void;
}) {
  const [engName, setEngName] = useState(employee?.eng_name || '');
  const [name, setName] = useState(employee?.name || '');
  const [status, setStatus] = useState(employee?.status || 'active');
  const [note, setNote] = useState(employee?.status_note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      eng_name: engName || (status === 'hiring' ? '채용필요' : ''),
      name: name || (status === 'hiring' ? '채용필요' : ''),
      status, status_note: note,
      branch_id: branch.id,
      slot_number: isHmSlot ? null : slotNum,
      is_hm: isHmSlot || false,
    };
    if (employee) {
      const { error } = await supabase.from('employees').update(payload).eq('id', employee.id);
      if (error) { alert('저장 실패: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('employees').insert(payload);
      if (error) { alert('저장 실패: ' + error.message); setSaving(false); return; }
    }
    onSaved();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (!confirm(`${employee.eng_name || employee.name}을(를) 이 슬롯에서 제거하시겠습니까?`)) return;
    setSaving(true);
    const { error } = await supabase.from('employees').update({
      branch_id: null, slot_number: null, is_hm: false
    }).eq('id', employee.id);
    if (error) { alert('제거 실패: ' + error.message); setSaving(false); return; }
    onSaved();
    setSaving(false);
  };

  const statusOptions = [
    { key: 'active', label: '재직' }, { key: 'hiring', label: '채용필요' },
    { key: 'onboarding', label: '입사대기' }, { key: 'transfer', label: '이동예정' },
    { key: 'leave', label: '휴직/육아' }, { key: 'resigning', label: '퇴사예정' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">{employee ? '슬롯 편집' : '인원 배치'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{branch.name}{isHmSlot ? ' - HM' : ` - 슬롯 ${slotNum}`}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">영문명 (English Name)</label>
            <input value={engName} onChange={e => setEngName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="e.g. Riley" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">한글 이름</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="e.g. 김다정" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map(o => (
                <button key={o.key} onClick={() => setStatus(o.key as any)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                    status === o.key ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="입사일, 퇴사 예정 등" />
          </div>
        </div>
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
            <button onClick={handleSave} disabled={saving || (!engName && status !== 'hiring')}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />{saving ? '저장중...' : '저장'}
            </button>
          </div>
          {employee && (
            <button onClick={handleDelete} disabled={saving}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" />슬롯에서 제거
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Roster View ───
function RosterView({ branches, employees, search, canEdit, onRefresh }: {
  branches: Branch[]; employees: Employee[]; search: string; canEdit: boolean; onRefresh: () => void;
}) {
  const [modal, setModal] = useState<Employee | 'new' | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [transferUploading, setTransferUploading] = useState(false);
  const [transferPreview, setTransferPreview] = useState<any[] | null>(null);

  const filtered = useMemo(() => {
    const active = employees.filter(e => e.status !== 'resigned');
    if (!search) return active;
    const q = search.toLowerCase();
    return active.filter(e =>
      e.name.includes(q) || e.eng_name.toLowerCase().includes(q) ||
      (e.email && e.email.includes(q)) ||
      (e.branch as any)?.name?.includes(q)
    );
  }, [employees, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('완전 삭제하시겠습니까? (복구 불가)')) return;
    await supabase.from('employees').delete().eq('id', id);
    onRefresh();
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명을 완전 삭제하시겠습니까? (복구 불가)`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('employees').delete().in('id', ids);
    if (error) { alert('삭제 실패: ' + error.message); }
    setBulkDeleting(false);
    setSelected(new Set());
    setMultiSelect(false);
    onRefresh();
  };

  // 엑셀 다운로드
  const handleDownloadExcel = () => {
    const statusLabel: Record<string, string> = {
      active: '재직', hiring: '채용필요', onboarding: '입사대기',
      transfer: '이동예정', leave: '휴직', resigning: '퇴사예정', resigned: '퇴사',
    };
    const data = filtered.map(emp => ({
      '이름': emp.name,
      '영문명': emp.eng_name,
      '이메일': emp.email || '',
      '지점': (emp.branch as any)?.name || '미배정',
      '상태': statusLabel[emp.status] || emp.status,
      '입사일자': emp.hire_date || '',
      '퇴사일자': emp.resign_date || '',
      '직책명': getRole(emp) === 'Lead' ? '리드' : getRole(emp),
      '사원코드': getCode(emp),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '인원리스트');
    // 컬럼 너비 자동
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    ];
    XLSX.writeFile(wb, `사원명부_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // 정기이동 엑셀 업로드 (탭2 형식: 지점명, 이름, ROLE, 입사일)
  const handleTransferUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      // 두번째 시트(탭2) 우선, 없으면 첫번째
      const sheetName = wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // 헤더 행 찾기 (지점명 포함된 행)
      let headerIdx = rows.findIndex(r => r.some((c: any) => typeof c === 'string' && c.includes('지점명')));
      if (headerIdx < 0) headerIdx = 0;

      const parsed: { branch_name: string; eng_name: string; role: string; hire_date?: string }[] = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const branchName = row[1]?.toString?.()?.trim();
        const engName = row[2]?.toString?.()?.trim();
        const role = row[3]?.toString?.()?.trim();
        if (!branchName) continue;
        // 날짜 처리
        let hireDate: string | undefined;
        if (row[4]) {
          if (typeof row[4] === 'number') {
            const d = XLSX.SSF.parse_date_code(row[4]);
            hireDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          } else {
            hireDate = row[4].toString();
          }
        }
        parsed.push({ branch_name: branchName, eng_name: engName || '', role: role || '', hire_date: hireDate });
      }
      setTransferPreview(parsed);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeTransfer = async () => {
    if (!transferPreview) return;
    setTransferUploading(true);
    let updated = 0, notFound: string[] = [], branchNotFound: string[] = [];

    // 1단계: 매칭 + 지점별 그룹핑
    type MatchedItem = { emp: Employee; branch: Branch | null; item: any; isHm: boolean; isLead: boolean };
    const matched: MatchedItem[] = [];

    for (const item of transferPreview) {
      if (!item.eng_name) continue;
      const branch = branches.find(b =>
        b.name === item.branch_name ||
        b.name.replace(/\s/g, '') === item.branch_name.replace(/\s/g, '') ||
        b.name.includes(item.branch_name) ||
        item.branch_name.includes(b.name)
      );
      if (!branch && item.branch_name !== 'HQ') {
        if (!branchNotFound.includes(item.branch_name)) branchNotFound.push(item.branch_name);
        continue;
      }
      const emp = employees.find(e => e.eng_name.toLowerCase() === item.eng_name.toLowerCase());
      if (!emp) { notFound.push(item.eng_name); continue; }

      const isPartjang = item.role === '파트장';
      const isLead = item.role === 'Lead' || item.role === '리드' || isPartjang;
      const isHm = item.role === 'HM' || isLead;
      matched.push({ emp, branch: branch || null, item, isHm, isLead });
    }

    // 2단계: 지점별 매니저를 입사일 빠른 순 정렬 → 슬롯 배정
    const branchSlots: Record<number, MatchedItem[]> = {};
    matched.forEach(m => {
      if (m.branch && !m.isHm) {
        if (!branchSlots[m.branch.id]) branchSlots[m.branch.id] = [];
        branchSlots[m.branch.id].push(m);
      }
    });
    const slotMap = new Map<number, number>(); // emp.id → slot_number
    Object.values(branchSlots).forEach(group => {
      group.sort((a, b) => {
        const da = a.item.hire_date || a.emp.hire_date || '9999';
        const db = b.item.hire_date || b.emp.hire_date || '9999';
        return da.localeCompare(db);
      });
      group.forEach((m, idx) => slotMap.set(m.emp.id, idx + 1));
    });

    // 3단계: DB 업데이트
    for (const m of matched) {
      const payload: any = {
        branch_id: m.branch ? m.branch.id : null,
        is_hm: m.isHm,
        slot_number: m.isHm ? null : (slotMap.get(m.emp.id) || null),
        status_note: m.item.role === '파트장' ? '파트장' : (m.item.role === 'Lead' || m.item.role === '리드') ? 'Lead' : '',
      };
      if (m.item.hire_date) payload.hire_date = m.item.hire_date;

      const { error } = await supabase.from('employees').update(payload).eq('id', m.emp.id);
      if (!error) updated++;
    }

    let msg = `✅ ${updated}명 이동 완료! (슬롯 입사일순 자동배정)`;
    if (notFound.length > 0) msg += `\n\n⚠️ 매칭 안된 이름 (${notFound.length}명):\n${notFound.join(', ')}`;
    if (branchNotFound.length > 0) msg += `\n\n⚠️ 매칭 안된 지점:\n${branchNotFound.join(', ')}`;
    alert(msg);
    setTransferUploading(false);
    setTransferPreview(null);
    onRefresh();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return d.substring(0, 10);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">운영파트 인원리스트</h2>
          <p className="text-sm text-gray-500">총 {filtered.length}명 (퇴사 제외)</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <label className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer transition">
              <RefreshCw className="w-4 h-4" />정기이동 업로드
              <input type="file" accept=".xlsx,.xls" onChange={handleTransferUpload} className="hidden" />
            </label>
          )}
          <button onClick={handleDownloadExcel}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition">
            <Download className="w-4 h-4" />엑셀 다운로드
          </button>
          {canEdit && (
            <button onClick={() => { setMultiSelect(!multiSelect); setSelected(new Set()); }}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition ${
                multiSelect ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}>
              {multiSelect ? '선택 취소' : '다중 선택'}
            </button>
          )}
          {canEdit && (
            <button onClick={() => setModal('new')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" />신규 등록
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {multiSelect && (
                <th className="text-center px-3 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                </th>
              )}
              <th className="text-left px-4 py-3 font-semibold">이름</th>
              <th className="text-left px-4 py-3 font-semibold">영문명</th>
              <th className="text-center px-3 py-3 font-semibold">직책</th>
              <th className="text-left px-4 py-3 font-semibold">소속</th>
              <th className="text-center px-4 py-3 font-semibold">상태</th>
              <th className="text-left px-4 py-3 font-semibold">이메일</th>
              <th className="text-center px-4 py-3 font-semibold">사원코드</th>
              <th className="text-center px-4 py-3 font-semibold">입사일</th>
              {canEdit && !multiSelect && <th className="text-center px-4 py-3 font-semibold w-24">관리</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id} className={`border-b transition ${
                multiSelect && selected.has(emp.id) ? 'bg-red-50' : 'hover:bg-gray-50'
              }`} onClick={multiSelect ? () => toggleSelect(emp.id) : undefined}
                style={multiSelect ? { cursor: 'pointer' } : undefined}>
                {multiSelect && (
                  <td className="text-center px-3 py-3">
                    <input type="checkbox" checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPartjangRole(emp.status_note) ? 'bg-indigo-100 text-indigo-700' :
                      isLeadRole(emp.status_note) ? 'bg-amber-100 text-amber-700' :
                      emp.is_hm ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {emp.eng_name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{emp.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{emp.eng_name}</td>
                <td className="text-center px-3 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isPartjangRole(emp.status_note) ? 'bg-indigo-100 text-indigo-700' :
                    isLeadRole(emp.status_note) ? 'bg-amber-100 text-amber-700' :
                    emp.is_hm ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'
                  }`}>{getRole(emp) === '파트장' ? '파트장' : getRole(emp) === 'Lead' ? '리드' : emp.is_hm ? 'HM' : '매니저'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{(emp.branch as any)?.name || '미배정'}</span>
                </td>
                <td className="text-center px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    emp.status === 'hiring' ? 'bg-yellow-100 text-yellow-700' :
                    emp.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                    emp.status === 'transfer' ? 'bg-purple-100 text-purple-700' :
                    emp.status === 'leave' ? 'bg-green-100 text-green-700' :
                    emp.status === 'resigning' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{emp.status === 'active' ? '재직' : emp.status === 'hiring' ? '채용필요' : emp.status === 'onboarding' ? '입사대기' : emp.status === 'transfer' ? '이동예정' : emp.status === 'leave' ? '휴직' : emp.status === 'resigning' ? '퇴사예정' : emp.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{emp.email || '-'}</td>
                <td className="text-center px-4 py-3 text-gray-500 text-xs font-mono">{getCode(emp) || '-'}</td>
                <td className="text-center px-4 py-3 text-gray-500 text-xs">{formatDate(emp.hire_date)}</td>
                {canEdit && !multiSelect && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal(emp)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Multi-select floating bar */}
      {multiSelect && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selected.size}명 선택</span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />{bulkDeleting ? '삭제 중...' : '일괄 삭제'}
          </button>
          <button onClick={() => { setSelected(new Set()); setMultiSelect(false); }}
            className="px-3 py-2 text-sm text-gray-300 hover:text-white">취소</button>
        </div>
      )}

      {/* 정기이동 미리보기 모달 */}
      {transferPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900">🔄 정기이동 미리보기</h3>
                <p className="text-sm text-gray-500 mt-1">총 {transferPreview.filter(t => t.eng_name).length}명 배치 변경</p>
              </div>
              <button onClick={() => setTransferPreview(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs">
                    <th className="text-left px-3 py-2">지점</th>
                    <th className="text-left px-3 py-2">이름</th>
                    <th className="text-center px-3 py-2">ROLE</th>
                    <th className="text-center px-3 py-2">입사일</th>
                    <th className="text-center px-3 py-2">매칭</th>
                  </tr>
                </thead>
                <tbody>
                  {transferPreview.filter(t => t.eng_name).map((item, i) => {
                    const emp = employees.find(e => e.eng_name.toLowerCase() === item.eng_name.toLowerCase());
                    const branch = branches.find(b =>
                      b.name === item.branch_name || b.name.replace(/\s/g,'') === item.branch_name.replace(/\s/g,'') ||
                      b.name.includes(item.branch_name) || item.branch_name.includes(b.name)
                    );
                    return (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${branch ? 'bg-blue-50 text-blue-700' : item.branch_name === 'HQ' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {item.branch_name}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">{item.eng_name}</td>
                        <td className="text-center px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.role === 'HM' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.role}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2 text-gray-500 text-xs">{item.hire_date || '-'}</td>
                        <td className="text-center px-3 py-2">
                          {emp ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">✗</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setTransferPreview(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={executeTransfer} disabled={transferUploading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw className={`w-4 h-4 ${transferUploading ? 'animate-spin' : ''}`} />
                {transferUploading ? '이동 처리 중...' : '이동 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <EmpModal
          employee={modal === 'new' ? undefined : modal}
          branches={branches}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function EmpModal({ employee, branches, onClose, onSaved }: {
  employee?: Employee; branches: Branch[]; onClose: () => void; onSaved: () => void;
}) {
  const empRole = employee ? getRole(employee) : '매니저';
  const roleMap: Record<string, string> = { '파트장': '파트장', 'Lead': 'Lead', 'HM': 'HM', '매니저': 'Mgr' };
  const [form, setForm] = useState({
    name: employee?.name || '',
    eng_name: employee?.eng_name || '',
    email: employee?.email || '',
    branch_id: employee?.branch_id || '',
    status: employee?.status || 'active',
    role: roleMap[empRole] || 'Mgr',
    hire_date: employee?.hire_date || '',
    resign_date: employee?.resign_date || '',
    employee_code: employee ? getCode(employee) : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const isHm = form.role === 'HM' || form.role === '파트장';
    const isLead = form.role === 'Lead';
    const roleStr = form.role === '파트장' ? '파트장' : form.role === 'Lead' ? 'Lead' : '';
    const statusNote = buildNote(roleStr, form.employee_code);

    // 슬롯 자동배정: HM/파트장은 null, 매니저/리드는 빈 슬롯 찾아서 배정
    let slotNumber: number | null = null;
    if (!isHm && form.branch_id) {
      // 해당 지점의 기존 슬롯 조회
      const { data: existing } = await supabase.from('employees')
        .select('slot_number')
        .eq('branch_id', form.branch_id)
        .not('slot_number', 'is', null)
        .order('slot_number');
      const usedSlots = new Set((existing || []).map(e => e.slot_number));
      // 수정 중이면 자기 슬롯은 제외
      if (employee?.slot_number && employee.branch_id === Number(form.branch_id)) {
        usedSlots.delete(employee.slot_number);
      }
      // 빈 슬롯 찾기 (1부터)
      let s = 1;
      while (usedSlots.has(s)) s++;
      slotNumber = s;
    }

    const payload = {
      name: form.name,
      eng_name: form.eng_name,
      email: form.email,
      branch_id: form.branch_id || null,
      status: form.status,
      is_hm: isHm,
      slot_number: isHm ? null : slotNumber,
      status_note: statusNote,
      hire_date: form.hire_date || null,
      resign_date: form.resign_date || null,
    };
    if (employee) {
      const { error } = await supabase.from('employees').update(payload).eq('id', employee.id);
      if (error) { alert('저장 실패: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('employees').insert(payload);
      if (error) { alert('저장 실패: ' + error.message); setSaving(false); return; }
    }
    onSaved();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">{employee ? '인원 정보 수정' : '신규 인원 등록'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          {[
            { k: 'name', l: '이름', ph: '홍길동' },
            { k: 'eng_name', l: '영문명', ph: 'Gildong' },
            { k: 'email', l: '이메일', ph: 'gildong.hong@handys.co.kr' },
            { k: 'employee_code', l: '사원코드', ph: '22073' },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                placeholder={f.ph} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">소속 지점</label>
            <select value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value ? Number(e.target.value) : '' as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="">미배정</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="active">재직</option>
              <option value="hiring">채용필요</option>
              <option value="onboarding">입사대기</option>
              <option value="transfer">이동예정</option>
              <option value="leave">휴직</option>
              <option value="resigning">퇴사예정</option>
              <option value="resigned">퇴사</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">입사일</label>
              <input type="date" value={form.hire_date} onChange={e => setForm(p => ({ ...p, hire_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">퇴사일</label>
              <input type="date" value={form.resign_date} onChange={e => setForm(p => ({ ...p, resign_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="Mgr">매니저</option>
              <option value="HM">HM (Head Manager)</option>
              <option value="Lead">리드</option>
              <option value="파트장">파트장</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.eng_name}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />{saving ? '저장중...' : employee ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary View ───
function SummaryView({ branches, employees }: { branches: Branch[]; employees: Employee[] }) {
  const regionStats = useMemo(() => {
    const stats: Record<string, { branches: number; to: number; filled: number; hiring: number; onboarding: number; transfer: number; leave: number }> = {};
    branches.forEach(b => {
      if (!stats[b.region]) stats[b.region] = { branches: 0, to: 0, filled: 0, hiring: 0, onboarding: 0, transfer: 0, leave: 0 };
      stats[b.region].branches++;
      stats[b.region].to += b.target_to;
    });
    employees.filter(e => e.status !== 'resigned').forEach(e => {
      if (!e.branch_id) return;
      const br = branches.find(b => b.id === e.branch_id);
      if (!br || !stats[br.region]) return;
      stats[br.region].filled++;
      if (e.status === 'hiring') stats[br.region].hiring++;
      if (e.status === 'onboarding') stats[br.region].onboarding++;
      if (e.status === 'transfer') stats[br.region].transfer++;
      if (e.status === 'leave') stats[br.region].leave++;
    });
    return stats;
  }, [branches, employees]);

  const total = useMemo(() =>
    Object.values(regionStats).reduce((a, s) => ({
      branches: a.branches + s.branches, to: a.to + s.to, filled: a.filled + s.filled,
      hiring: a.hiring + s.hiring, onboarding: a.onboarding + s.onboarding,
      transfer: a.transfer + s.transfer, leave: a.leave + s.leave,
    }), { branches: 0, to: 0, filled: 0, hiring: 0, onboarding: 0, transfer: 0, leave: 0 })
  , [regionStats]);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">인원 현황 요약</h2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { l: '총 지점', v: total.branches, u: '개', bg: 'bg-gray-50' },
          { l: '총 TO', v: total.to, u: '명', bg: 'bg-gray-50' },
          { l: '현 인원', v: total.filled, u: '명', bg: 'bg-emerald-50', c: 'text-emerald-700' },
          { l: '채용 필요', v: total.hiring, u: '명', bg: 'bg-red-50', c: 'text-red-700' },
          { l: '입사 대기', v: total.onboarding, u: '명', bg: 'bg-blue-50', c: 'text-blue-700' },
          { l: '이동 예정', v: total.transfer, u: '명', bg: 'bg-purple-50', c: 'text-purple-700' },
        ].map(card => (
          <div key={card.l} className={`${card.bg} rounded-xl p-4 border`}>
            <div className="text-xs text-gray-500 mb-1">{card.l}</div>
            <div className={`text-2xl font-bold ${card.c || 'text-gray-900'}`}>{card.v}<span className="text-sm font-normal text-gray-400 ml-1">{card.u}</span></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {['지역','지점 번호','고정TO','현인원','과부족','채용필요','입사대기','이동예정','충원율'].map(h =>
                <th key={h} className={`${h==='지역'?'text-left':'text-center'} px-4 py-3 font-semibold`}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(regionStats).map(([rgn, s]) => {
              const diff = s.filled - s.to;
              const rate = s.to > 0 ? Math.round((s.filled / s.to) * 100) : 0;
              return (
                <tr key={rgn} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{rgn}</td>
                  <td className="text-center px-4 py-3">{s.branches}</td>
                  <td className="text-center px-4 py-3 font-medium">{s.to}</td>
                  <td className="text-center px-4 py-3 font-bold text-emerald-600">{s.filled}</td>
                  <td className="text-center px-4 py-3"><span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff >= 0 ? `+${diff}` : diff}</span></td>
                  <td className="text-center px-4 py-3">{s.hiring > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{s.hiring}</span>}</td>
                  <td className="text-center px-4 py-3">{s.onboarding > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{s.onboarding}</span>}</td>
                  <td className="text-center px-4 py-3">{s.transfer > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{s.transfer}</span>}</td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{rate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td className="px-4 py-3 font-bold">합계</td>
              <td className="text-center px-4 py-3 font-bold">{total.branches}</td>
              <td className="text-center px-4 py-3 font-bold">{total.to}</td>
              <td className="text-center px-4 py-3 font-bold text-emerald-600">{total.filled}</td>
              <td className="text-center px-4 py-3"><span className={`font-bold ${total.filled - total.to >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{total.filled - total.to >= 0 ? `+${total.filled - total.to}` : total.filled - total.to}</span></td>
              <td className="text-center px-4 py-3 font-bold text-red-600">{total.hiring}</td>
              <td className="text-center px-4 py-3 font-bold text-blue-600">{total.onboarding}</td>
              <td className="text-center px-4 py-3 font-bold text-purple-600">{total.transfer}</td>
              <td className="text-center px-4 py-3 font-bold">{total.to > 0 ? Math.round((total.filled / total.to) * 100) : 0}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Settings View (Admin only) ───
function SettingsView({ branches }: { branches: Branch[] }) {
  const [settingsTab, setSettingsTab] = useState<'users' | 'branches' | 'upload'>('users');
  const settingsTabs = [
    { id: 'users' as const, label: '사용자 권한', icon: Shield },
    { id: 'branches' as const, label: '지점 관리', icon: MapPin },
    { id: 'upload' as const, label: '일괄 업로드', icon: Upload },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {settingsTabs.map(t => (
          <button key={t.id} onClick={() => setSettingsTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
              settingsTab === t.id ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>
      {settingsTab === 'users' && <UserRolesSection />}
      {settingsTab === 'branches' && <BranchManageSection />}
      {settingsTab === 'upload' && <BulkUploadSection branches={branches} />}
    </div>
  );
}

// ─── User Roles Section ───
function UserRolesSection() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    supabase.from('user_roles').select('*').order('role').then(({ data }) => {
      if (data) setRoles(data as UserRole[]);
    });
  }, []);

  const handleAdd = async () => {
    if (!newEmail || !newName) return;
    const { error } = await supabase.from('user_roles').insert({ email: newEmail, role: newRole, name: newName });
    if (error) { alert('추가 실패: ' + error.message); return; }
    setShowAdd(false); setNewEmail(''); setNewName(''); setNewRole('viewer');
    const { data } = await supabase.from('user_roles').select('*').order('role');
    if (data) setRoles(data as UserRole[]);
  };

  const handleRoleChange = async (email: string, role: string) => {
    await supabase.from('user_roles').update({ role }).eq('email', email);
    const { data } = await supabase.from('user_roles').select('*').order('role');
    if (data) setRoles(data as UserRole[]);
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`${email} 사용자를 삭제하시겠습니까?`)) return;
    await supabase.from('user_roles').delete().eq('email', email);
    setRoles(roles.filter(r => r.email !== email));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">사용자 권한 관리</h2>
          <p className="text-sm text-gray-500">플랫폼 접근 권한을 관리합니다</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" />사용자 추가
        </button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 font-semibold">이름</th>
            <th className="text-left px-4 py-3 font-semibold">이메일</th>
            <th className="text-center px-4 py-3 font-semibold">역할</th>
            <th className="text-center px-4 py-3 font-semibold w-24">관리</th>
          </tr></thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.email} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.email}</td>
                <td className="text-center px-4 py-3">
                  <select value={r.role} onChange={e => handleRoleChange(r.email, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border font-medium ${
                      r.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                      r.role === 'editor' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleDelete(r.email)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-900">사용자 추가</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="gildong.hong@handys.co.kr" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="viewer">Viewer (조회만)</option><option value="editor">Editor (편집 가능)</option><option value="admin">Admin (전체 관리)</option>
                </select></div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={handleAdd} disabled={!newEmail || !newName}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Branch Management Section ───
function BranchManageSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ branch_num: '', name: '', region: '서울', target_to: '5', note: '' });
  const regions = ['HQ', '강원', '경기', '부울경', '서울', '인천', '제주'];

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('branch_num');
    if (data) setBranches(data as Branch[]);
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const resetForm = () => { setForm({ branch_num: '', name: '', region: '서울', target_to: '5', note: '' }); setEditId(null); setShowAdd(false); };

  const handleSave = async () => {
    const payload = { branch_num: Number(form.branch_num), name: form.name, region: form.region, target_to: Number(form.target_to), note: form.note };
    if (editId) {
      const { error } = await supabase.from('branches').update(payload).eq('id', editId);
      if (error) { alert('수정 실패: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('branches').insert(payload);
      if (error) { alert('추가 실패: ' + error.message); return; }
    }
    resetForm(); loadBranches();
  };

  const handleEdit = (b: Branch) => {
    setForm({ branch_num: String(b.branch_num), name: b.name, region: b.region, target_to: String(b.target_to), note: b.note || '' });
    setEditId(b.id); setShowAdd(true);
  };

  const handleDelete = async (b: Branch) => {
    if (!confirm(`"${b.name}" 지점을 삭제하시겠습니까? 배치된 인원 데이터에 영향을 줄 수 있습니다.`)) return;
    await supabase.from('branches').delete().eq('id', b.id);
    loadBranches();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">지점 관리</h2>
          <p className="text-sm text-gray-500">지점 추가, 수정, 삭제</p>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" />지점 추가
        </button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-center px-3 py-3 font-semibold w-16">#</th>
            <th className="text-left px-4 py-3 font-semibold">지점명</th>
            <th className="text-center px-4 py-3 font-semibold">지역</th>
            <th className="text-center px-4 py-3 font-semibold w-16">TO</th>
            <th className="text-left px-4 py-3 font-semibold">비고</th>
            <th className="text-center px-4 py-3 font-semibold w-24">관리</th>
          </tr></thead>
          <tbody>
            {branches.map(b => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="text-center px-3 py-2.5 text-gray-400 text-xs">{b.branch_num}</td>
                <td className="px-4 py-2.5 font-medium">{b.name}</td>
                <td className="text-center px-4 py-2.5"><span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{b.region}</span></td>
                <td className="text-center px-4 py-2.5 font-bold">{b.target_to}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{b.note}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleEdit(b)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-900">{editId ? '지점 수정' : '지점 추가'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">지점번호</label>
                  <input type="number" value={form.branch_num} onChange={e => setForm(p => ({ ...p, branch_num: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="1" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">기준 TO</label>
                  <input type="number" value={form.target_to} onChange={e => setForm(p => ({ ...p, target_to: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="5" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">지점명</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="강남 시그니티" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
                <select value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="메모" /></div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={resetForm} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={handleSave} disabled={!form.name || !form.branch_num}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{editId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Upload Section ───
function BulkUploadSection({ branches }: { branches: Branch[] }) {
  const [uploadType, setUploadType] = useState<'employees' | 'branches'>('employees');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('file');
  const [textInput, setTextInput] = useState('');
  const [parsed, setParsed] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);
  const [defaultRegion, setDefaultRegion] = useState('HQ');
  const regions = ['HQ', '강원', '경기', '부울경', '서울', '인천', '제주'];

  const parseEmployees = (text: string) => {
    const items: { name: string; eng_name: string }[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isTabular = lines.some(l => l.includes('\t') || l.includes(','));
    if (isTabular) {
      lines.forEach(line => {
        const parts = line.split(/[\t,]+/).map(s => s.trim());
        if (parts.length >= 2) items.push({ name: parts[0], eng_name: parts[1] });
      });
    } else {
      const joined = lines.join('');
      const regex = /([\uAC00-\uD7AF]{2,4})([A-Za-z][A-Za-z ]*?)(?=[\uAC00-\uD7AF]|$)/g;
      let match;
      while ((match = regex.exec(joined)) !== null) items.push({ name: match[1], eng_name: match[2].trim() });
    }
    return items;
  };

  const parseBranches = (text: string) => {
    const items: { branch_num: number; name: string }[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isTabular = lines.some(l => l.includes('\t') || l.includes(','));
    if (isTabular) {
      lines.forEach(line => {
        const parts = line.split(/[\t,]+/).map(s => s.trim());
        if (parts.length >= 2 && !isNaN(Number(parts[0]))) items.push({ branch_num: Number(parts[0]), name: parts[1] });
      });
    } else {
      const joined = lines.join('\n');
      const regex = /(\d+)\s*([^\d\n]+?)(?=\d|\n*$)/g;
      let match;
      while ((match = regex.exec(joined)) !== null) items.push({ branch_num: Number(match[1]), name: match[2].trim() });
    }
    return items;
  };

  const handleParse = () => {
    setResult(null);
    if (uploadType === 'employees') setParsed(parseEmployees(textInput));
    else setParsed(parseBranches(textInput));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      const sep = ext === 'tsv' ? '\t' : ',';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["\ufeff]/g, ''));
      const rows = lines.slice(1);

      if (uploadType === 'employees') {
        const nameIdx = headers.findIndex(h => h === '이름' || h === 'name' || h === '한글명');
        const engIdx = headers.findIndex(h => h === '영문명' || h === 'eng_name' || h === 'english' || h === '영문이름');
        const emailIdx = headers.findIndex(h => h === '이메일' || h === 'email');
        const branchIdx = headers.findIndex(h => h === '지점' || h === 'branch' || h === '지점명');
        const statusIdx = headers.findIndex(h => h === '상태' || h === 'status');

        const items = rows.map(row => {
          const cols = row.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            name: nameIdx >= 0 ? cols[nameIdx] : cols[0] || '',
            eng_name: engIdx >= 0 ? cols[engIdx] : cols[1] || '',
            email: emailIdx >= 0 ? cols[emailIdx] : '',
            branch_name: branchIdx >= 0 ? cols[branchIdx] : '',
            status: statusIdx >= 0 ? cols[statusIdx] : 'active',
          };
        }).filter(i => i.name || i.eng_name);
        setParsed(items);
      } else {
        const numIdx = headers.findIndex(h => h === '번호' || h === 'num' || h === 'branch_num' || h === '#');
        const nameIdx = headers.findIndex(h => h === '지점명' || h === 'name' || h === '이름');
        const regionIdx = headers.findIndex(h => h === '지역' || h === 'region');
        const toIdx = headers.findIndex(h => h === 'to' || h === 'target' || h === '목표인원');

        const items = rows.map(row => {
          const cols = row.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            branch_num: numIdx >= 0 ? Number(cols[numIdx]) : 0,
            name: nameIdx >= 0 ? cols[nameIdx] : cols[0] || '',
            region: regionIdx >= 0 ? cols[regionIdx] : defaultRegion,
            target_to: toIdx >= 0 ? Number(cols[toIdx]) || 5 : 5,
          };
        }).filter(i => i.name);
        setParsed(items);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length < 2) return;

        const headers = data[0].map((h: any) => String(h || '').trim().toLowerCase());
        const rows = data.slice(1).filter((r: any[]) => r.some(c => c != null && c !== ''));

        if (uploadType === 'employees') {
          const nameIdx = headers.findIndex((h: string) => h === '이름' || h === 'name' || h === '한글명');
          const engIdx = headers.findIndex((h: string) => h === '영문명' || h === 'eng_name' || h === 'english');
          const emailIdx = headers.findIndex((h: string) => h === '이메일' || h === 'email');
          const branchIdx = headers.findIndex((h: string) => h === '지점' || h === 'branch' || h === '지점명');
          const statusIdx = headers.findIndex((h: string) => h === '상태' || h === 'status');
          const hireDateIdx = headers.findIndex((h: string) => h === '입사일자' || h === '입사일' || h === 'hire_date');
          const resignDateIdx = headers.findIndex((h: string) => h === '퇴사일자' || h === '퇴사일' || h === 'resign_date');
          const titleIdx = headers.findIndex((h: string) => h === '직책명' || h === '직책' || h === 'title' || h === 'role');
          const codeIdx = headers.findIndex((h: string) => h === '사원코드' || h === 'employee_code' || h === 'code');

          const statusMap: Record<string, string> = { '재직': 'active', '휴직': 'leave', '퇴사': 'resigned', '퇴사예정': 'resigning', '채용필요': 'hiring', '입사대기': 'onboarding', '이동예정': 'transfer' };
          const hmTitles = ['HM', 'Lead', '리드', '파트장'];

          const items = rows.map((row: any[]) => {
            const title = titleIdx >= 0 ? String(row[titleIdx] || '').trim() : '';
            let roleNote = '';
            if (title === 'Lead' || title === '리드') roleNote = 'Lead';
            else if (title === '파트장') roleNote = '파트장';
            const empCode = codeIdx >= 0 ? String(row[codeIdx] || '').trim() : '';
            return {
              name: nameIdx >= 0 ? String(row[nameIdx] || '') : String(row[0] || ''),
              eng_name: engIdx >= 0 ? String(row[engIdx] || '') : String(row[1] || ''),
              email: emailIdx >= 0 ? String(row[emailIdx] || '') : '',
              branch_name: branchIdx >= 0 ? String(row[branchIdx] || '') : '',
              status: statusIdx >= 0 ? (statusMap[String(row[statusIdx] || '').trim()] || 'active') : 'active',
              hire_date: hireDateIdx >= 0 ? String(row[hireDateIdx] || '') : '',
              resign_date: resignDateIdx >= 0 ? String(row[resignDateIdx] || '') : '',
              is_hm: hmTitles.includes(title),
              status_note: buildNote(roleNote, empCode),
            };
          }).filter((i: any) => i.name || i.eng_name);
          setParsed(items);
        } else {
          const numIdx = headers.findIndex((h: string) => h === '번호' || h === 'num' || h === '#');
          const nameIdx = headers.findIndex((h: string) => h === '지점명' || h === 'name' || h === '이름');
          const regionIdx = headers.findIndex((h: string) => h === '지역' || h === 'region');
          const toIdx = headers.findIndex((h: string) => h === 'to' || h === 'target');

          const items = rows.map((row: any[]) => ({
            branch_num: numIdx >= 0 ? Number(row[numIdx]) || 0 : 0,
            name: nameIdx >= 0 ? String(row[nameIdx] || '') : String(row[0] || ''),
            region: regionIdx >= 0 ? String(row[regionIdx] || defaultRegion) : defaultRegion,
            target_to: toIdx >= 0 ? Number(row[toIdx]) || 5 : 5,
          })).filter((i: any) => i.name);
          setParsed(items);
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (parsed.length === 0) return;
    setUploading(true);
    let success = 0, fail = 0;
    const errors: string[] = [];

    if (uploadType === 'employees') {
      // 지점 매칭 맵 생성
      const branchMap: Record<string, number> = {};
      branches.forEach(b => {
        branchMap[b.name] = b.id;
        branchMap[b.name.replace(/\s/g, '')] = b.id;
      });

      // 입사일 기준 정렬 후 지점별 슬롯 자동 배정
      const enriched = (parsed as any[]).map(p => {
        const branchId = p.branch_name ? (branchMap[p.branch_name] || branchMap[p.branch_name.replace(/\s/g, '')] || null) : null;
        return { ...p, branchId };
      });

      // 지점별로 그룹핑 → 입사일 빠른 순 정렬 → 슬롯 번호 배정
      const branchGroups: Record<number, any[]> = {};
      enriched.forEach(p => {
        if (p.branchId && !(p.is_hm)) {
          if (!branchGroups[p.branchId]) branchGroups[p.branchId] = [];
          branchGroups[p.branchId].push(p);
        }
      });
      // 입사일 빠른 순 정렬
      Object.values(branchGroups).forEach(group => {
        group.sort((a: any, b: any) => {
          const da = a.hire_date || '9999';
          const db = b.hire_date || '9999';
          return da.localeCompare(db);
        });
        group.forEach((p: any, idx: number) => { p._slotNumber = idx + 1; });
      });

      for (const p of enriched) {
        const isHm = p.is_hm || false;

        const row: any = {
          name: p.name || '',
          eng_name: p.eng_name || '',
          email: p.email || null,
          status: p.status || 'active',
          branch_id: p.branchId,
          is_hm: isHm,
          slot_number: isHm ? null : (p._slotNumber || null),
          status_note: p.status_note || '',
        };
        if (p.hire_date) row.hire_date = p.hire_date;
        if (p.resign_date) row.resign_date = p.resign_date;

        // 이메일이 있으면 upsert (이메일 기준), 없으면 영문명+이름으로 찾아서 update, 아니면 insert
        if (row.email) {
          const { error } = await supabase.from('employees').upsert(row, { onConflict: 'email' });
          if (error) { fail++; errors.push(`${p.eng_name || p.name}: ${error.message}`); }
          else { success++; }
        } else {
          const { data: existing } = await supabase.from('employees')
            .select('id').eq('eng_name', row.eng_name).eq('name', row.name).limit(1);
          if (existing && existing.length > 0) {
            const { error } = await supabase.from('employees').update(row).eq('id', existing[0].id);
            if (error) { fail++; errors.push(`${p.eng_name || p.name}: ${error.message}`); }
            else { success++; }
          } else {
            const { error } = await supabase.from('employees').insert(row);
            if (error) { fail++; errors.push(`${p.eng_name || p.name}: ${error.message}`); }
            else { success++; }
          }
        }
      }
    } else {
      for (const p of parsed) {
        const { error } = await supabase.from('branches').insert({
          branch_num: (p as any).branch_num,
          name: (p as any).name,
          region: (p as any).region || defaultRegion,
          target_to: (p as any).target_to || 5,
          note: '',
        });
        if (error) { fail++; errors.push(`#${(p as any).branch_num} ${(p as any).name}: ${error.message}`); }
        else { success++; }
      }
    }

    setResult({ success, fail, errors });
    setUploading(false);
  };

  const handleRemoveItem = (idx: number) => {
    setParsed(p => p.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">일괄 업로드</h2>
          <p className="text-sm text-gray-500">엑셀/CSV 파일 또는 텍스튼로 데이터를 한번에 등록</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setUploadType('employees'); setParsed([]); setResult(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${uploadType === 'employees' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border'}`}>
            <Users className="w-3.5 h-3.5 inline mr-1" />인원
          </button>
          <button onClick={() => { setUploadType('branches'); setParsed([]); setResult(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${uploadType === 'branches' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border'}`}>
            <MapPin className="w-3.5 h-3.5 inline mr-1" />지점
          </button>
        </div>
      </div>

      {/* Input mode toggle */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setInputMode('file')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${inputMode === 'file' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
          <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />파일 업로드
        </button>
        <button onClick={() => setInputMode('text')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${inputMode === 'text' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
          <Edit3 className="w-3.5 h-3.5 inline mr-1" />텍스트 붙여넣기
        </button>
      </div>

      {/* File upload area */}
      {inputMode === 'file' && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {uploadType === 'employees' ? '인원 파일 업로드' : '지점 파일 업로드'}
          </label>
          <p className="text-xs text-gray-400 mb-3">
            {uploadType === 'employees'
              ? '엑셀/CSV 파일 (컬럼: 이름, 영문명, 이메일, 지점, 상태)'
              : '엑셀/CSV 파일 (컬럼: 번호, 지점명, 지역, TO)'}
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 transition relative">
            <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">xlsx, csv, tsv 파일을 선택하세요</p>
            <p className="text-xs text-gray-400">첫번째 행이 헤더(컬럼명)여야 합니다</p>
            <input type="file" accept=".xlsx,.xls,.csv,.tsv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          {uploadType === 'branches' && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs text-gray-500">파일에 지역 컬럼이 없을 경우 기본 지역:</label>
              <select value={defaultRegion} onChange={e => setDefaultRegion(e.target.value)}
                className="text-xs border rounded px-2 py-1">
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Text input area */}
      {inputMode === 'text' && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {uploadType === 'employees' ? '인원 데이터 붙여넣기' : '지점 데이터 붙여넣기'}
          </label>
          <p className="text-xs text-gray-400 mb-2">
            {uploadType === 'employees'
              ? '형식: 이름,영문명 (줄바꿈/탭/쉼표) 또는 연속텍스트 (홍길동Gildong김영희Young...)'
              : '형식: 번호,지점명 (줄바꿈/탭/쉼표) 또는 연속텍스트 (1HQ2서면4명동...)'}
          </p>
          <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
            rows={8} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y"
            placeholder={uploadType === 'employees' ? '우민주MJ\n이세아Claire\n...' : '1HQ\n2서면\n4명동\n...'} />
          {uploadType === 'branches' && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-gray-500">기본 지역:</label>
              <select value={defaultRegion} onChange={e => setDefaultRegion(e.target.value)}
                className="text-xs border rounded px-2 py-1">
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={handleParse} disabled={!textInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              미리보기 파싱
            </button>
            {parsed.length > 0 && (
              <button onClick={() => { setParsed([]); setResult(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">초기화</button>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">파싱 결과: {parsed.length}건</span>
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />{uploading ? '업로드 중...' : `${parsed.length}건 일괄 등록`}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b sticky top-0">
                {uploadType === 'employees' ? (
                  <><th className="text-left px-4 py-2 font-semibold">#</th>
                    <th className="text-left px-4 py-2 font-semibold">이름</th>
                    <th className="text-left px-4 py-2 font-semibold">영문명</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">삭제</th></>
                ) : (
                  <><th className="text-center px-4 py-2 font-semibold w-16">번호</th>
                    <th className="text-left px-4 py-2 font-semibold">지점명</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">삭제</th></>
                )}
              </tr></thead>
              <tbody>
                {parsed.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    {uploadType === 'employees' ? (
                      <><td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{(item as any).name || <span className="text-gray-300">-</span>}</td>
                        <td className="px-4 py-2">{(item as any).eng_name}</td></>
                    ) : (
                      <><td className="text-center px-4 py-2 text-gray-400">{(item as any).branch_num}</td>
                        <td className="px-4 py-2 font-medium">{(item as any).name}</td></>
                    )}
                    <td className="text-center px-4 py-2">
                      <button onClick={() => handleRemoveItem(idx)} className="p-1 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-4 ${result.fail > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold text-emerald-700">성공: {result.success}건</span>
            {result.fail > 0 && <span className="text-sm font-bold text-red-600">실패: {result.fail}건</span>}
          </div>
          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 space-y-1 mt-2">
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
