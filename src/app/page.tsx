'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, signInWithMagicLink, signOut, getUserRole } from '@/lib/supabase';
import type { Branch, Employee, UserRole } from '@/lib/supabase';
import {
  Search, Plus, Edit3, Trash2, Users, BarChart3, LayoutGrid, Settings,
  ChevronDown, ChevronRight, X, Save, Filter, LogOut, Shield
} from 'lucide-react';

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
          <h1 className="text-xl font-bold text-gray-900 mb-1">핸디즈 인원관리</h1>
          <p className="text-sm text-gray-500 mb-6">운영지원팀 전욨 플랫폼</p>
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
              <h1 className="text-lg font-bold text-gray-900">핸디즈 인원관리</h1>
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
        {tab === 'settings' && isAdmin && <SettingsView />}
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
  const regions = ['전체', '강원', '경기', '부울경', '서울', '인천', '제주'];

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
    const groups: Record<string, (Branch & { emps: Employee[]; hm?: Employee })[]> = {};
    filtered.forEach(b => {
      if (!groups[b.region]) groups[b.region] = [];
      const emps = employees.filter(e => e.branch_id === b.id && e.status !== 'resigned');
      const hm = emps.find(e => e.is_hm);
      groups[b.region].push({ ...b, emps, hm });
    });
    return groups;
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
    setModal({ branch, slotNum, employee: emp });
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { l: '총 TO', v: stats.totalTO, c: 'text-gray-900' },
          { l: '현 인원', v: stats.filled, c: 'text-emerald-600' },
          { l: '채욨 필요', v: stats.hiring, c: 'text-red-600' },
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
                          <td className="text-center px-2 py-2">
                            <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
                              {br.hm?.eng_name || '-'}
                            </span>
                          </td>
                          {[1,2,3,4,5,6,7,8,9].map(slotNum => {
                            const emp = br.emps.find(e => e.slot_number === slotNum);
                            return (
                              <td key={slotNum} className="px-1 py-1.5">
                                {emp ? (
                                  <button onClick={() => handleSlotClick(br, slotNum)}
                                    className={`w-full min-h-[40px] px-2 py-1 border rounded-lg text-left text-xs leading-tight transition hover:shadow-md ${
                                      emp.status === 'hiring' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
                                      emp.status === 'onboarding' ? 'bg-blue-50 border-blue-400 text-blue-800' :
                                      emp.status === 'transfer' ? 'bg-purple-50 border-purple-400 text-purple-800' :
                                      emp.status === 'leave' ? 'bg-green-50 border-green-400 text-green-800' :
                                      'bg-white border-gray-200'
                                    }`}>
                                    <div className="font-medium">{emp.eng_name}</div>
                                    {emp.status_note && <div className="text-gray-500 text-[10px]">{emp.status_note}</div>}
                                  </button>
                                ) : (
                                  <button onClick={() => handleSlotClick(br, slotNum)}
                                    className="w-full h-10 border border-dashed border-gray-300 rounded-lg text-gray-300 hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-50 transition flex items-center justify-center">
                                    <Plus className="w-3 h-3" />
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

      {/* Slot Modal */}
      {modal && (
        <SlotModal
          branch={modal.branch} slotNum={modal.slotNum} employee={modal.employee}
          employees={employees} onClose={() => setModal(null)} onSaved={() => { setModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function SlotModal({ branch, slotNum, employee, employees, onClose, onSaved }: {
  branch: Branch; slotNum: number; employee?: Employee; employees: Employee[];
  onClose: () => void; onSaved: () => void;
}) {
  const [engName, setEngName] = useState(employee?.eng_name || '');
  const [name, setName] = useState(employee?.name || '');
  const [status, setStatus] = useState(employee?.status || 'active');
  const [note, setNote] = useState(employee?.status_note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (employee) {
        await supabase.from('employees').update({
          eng_name: engName, name, status, status_note: note,
          branch_id: branch.id, slot_number: slotNum
        }).eq('id', employee.id);
      } else {
        await supabase.from('employees').insert({
          eng_name: engName, name, status, status_note: note,
          branch_id: branch.id, slot_number: slotNum
        });
      }
      onSaved();
    } catch (e) { alert('저장 실패'); }
    setSaving(false);
  };

  const statusOptions = [
    { key: 'active', label: '재직' }, { key: 'hiring', label: '채용필요' },
    { key: 'onboarding', label: '입사대기' }, { key: 'transfer', label: '이동옄정' },
    { key: 'leave', label: '휴직/육가' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">{employee ? '슬롯 편집' : '인원 배치'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{branch.name} - 슬롭 {slotNum}</p>
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
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
          <button onClick={handleSave} disabled={saving || !engName}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />{saving ? '저장중...' : '저장'}
          </button>
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
    if (!confirm('퇴사 처리하시겠습니까?')) return;
    await supabase.from('employees').update({ status: 'resigned', resign_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">운영파트 인원리스트</h2>
          <p className="text-sm text-gray-500">총 {filtered.length}명 (퇴사 제외)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" />신규 등록
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-semibold">이름</th>
              <th className="text-left px-4 py-3 font-semibold">영문명</th>
              <th className="text-left px-4 py-3 font-semibold">이메일</th>
              <th className="text-left px-4 py-3 font-semibold">소속</th>
              <th className="text-center px-4 py-3 font-semibold">상태</th>
              {canEdit && <th className="text-center px-4 py-3 font-semibold w-24">관리</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                      {emp.eng_name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{emp.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{emp.eng_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{emp.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{(emp.branch as any)?.name || '-'}</span>
                </td>
                <td className="text-center px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    emp.status === 'hiring' ? 'bg-yellow-100 text-yellow-700' :
                    emp.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                    emp.status === 'transfer' ? 'bg-purple-100 text-purple-700' :
                    emp.status === 'leave' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{emp.status === 'active' ? '재직' : emp.status === 'hiring' ? '채용필요' : emp.status === 'onboarding' ? '입사대기' : emp.status === 'transfer' ? '이동예정' : emp.status === 'leave' ? '휴직' : emp.status}</span>
                </td>
                {canEdit && (
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
  const [form, setForm] = useState({
    name: employee?.name || '',
    eng_name: employee?.eng_name || '',
    email: employee?.email || '',
    branch_id: employee?.branch_id || '',
    status: employee?.status || 'active',
    is_hm: employee?.is_hm || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, branch_id: form.branch_id || null };
      if (employee) {
        await supabase.from('employees').update(payload).eq('id', employee.id);
      } else {
        await supabase.from('employees').insert(payload);
      }
      onSaved();
    } catch (e) { alert('저장 실패'); }
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
              <option value="">민배정</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isHm" checked={form.is_hm} onChange={e => setForm(p => ({ ...p, is_hm: e.target.checked }))}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <label htmlFor="isHm" className="text-sm text-gray-700">HM (Head Manager)</label>
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
              {['지역','지점수','기줔TO','현인원','과부족','채용필요','입사대기','이동예정','충월율'].map(h =>
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
function SettingsView() {
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
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-semibold">이름</th>
              <th className="text-left px-4 py-3 font-semibold">이메일</th>
              <th className="text-center px-4 py-3 font-semibold">역할</th>
              <th className="text-center px-4 py-3 font-semibold w-24">관리</th>
            </tr>
          </thead>
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
                  <button onClick={() => handleDelete(r.email)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role descriptions */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-medium text-gray-900 mb-3">역할 설명</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium w-16 text-center flex-shrink-0">Admin</span>
            <span className="text-gray-600">모든 데이터 조회/편집 + 사용자 권한 관리 + 지점 설정</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium w-16 text-center flex-shrink-0">Editor</span>
            <span className="text-gray-600">모든 데이터 조회/편집 (인원 등록, 배치 변경, 퇴사 처리)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium w-16 text-center flex-shrink-0">Viewer</span>
            <span className="text-gray-600">모든 데이터 조회만 가능 (편집 불가)</span>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-900">사용자 추가</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="gildong.hong@handys.co.kr"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="viewer">Viewer (조회만)</option>
                  <option value="editor">Editor (편집 가능)</option>
                  <option value="admin">Admin (전체 관리)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">뷨소</button>
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

