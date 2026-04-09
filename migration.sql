-- ============================================
-- 핸디즈 인원관리 플랫폼 - Database Schema
-- ============================================

-- 1. 지점 (Branches)
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  branch_num INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('강원','경기','부울경','서울','인천','제주')),
  target_to INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 사원 (Employees)
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  eng_name TEXT NOT NULL,
  email TEXT UNIQUE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hiring','onboarding','transfer','leave','resigned')),
  slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 9),
  is_hm BOOLEAN DEFAULT FALSE,
  hire_date DATE,
  resign_date DATE,
  status_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 인원상태 변경 이력
CREATE TABLE status_history (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  old_branch_id INTEGER REFERENCES branches(id),
  new_branch_id INTEGER REFERENCES branches(id),
  changed_by TEXT,
  memo TEXT DEFAULT '',
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 사용자 권한 (앱 접근 제어)
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Initial Data: User Roles
-- ============================================
INSERT INTO user_roles (email, role, name) VALUES
  ('abby.lim@handys.co.kr', 'admin', 'Abby'),
  ('mark.cha@handys.co.kr', 'editor', 'Mark'),
  ('eddy.moon@handys.co.kr', 'viewer', 'Eddy');

-- ============================================
-- Initial Data: Branches (28개 지점)
-- ============================================
INSERT INTO branches (branch_num, name, region, target_to, note) VALUES
  (8,  '속초해변C',        '강원', 4, ''),
  (10, '속초동대해변',      '강원', 5, ''),
  (22, '속초해변AB',       '강원', 5, ''),
  (27, '낙산해변',         '강원', 4, ''),
  (28, '속초해변',         '강원', 6, ''),
  (29, '속초용아',         '강원', 7, ''),
  (32, '속초자이에맸',     '강원', 6, ''),
  (3,  '동탄',            '경기', 4, ''),
  (18, '시흥웨이브파크',    '경기', 9, ''),
  (21, '당진터미널',       '경기', 5, ''),
  (25, '시홥거북센',       '경기', 7, ''),
  (2,  '서면',            '부울경', 6, ''),
  (6,  '부산역',          '부울경', 5, ''),
  (11, '부산시청',         '부울경', 4, ''),
  (12, '부산기장',         '부울경', 5, ''),
  (13, '남포BIFF',        '부울경', 4, ''),
  (14, '울산스타즈',       '부울경', 8, ''),
  (19, '부산송도해변',      '부울경', 5, ''),
  (24, '해운대파라크라프',   '부울경', 5, ''),
  (26, '해운대역',         '부울경', 5, ''),
  (4,  '명동',            '서울', 4, ''),
  (15, '강예전시그니티',    '서울', 5, ''),
  (17, '익선',            '서울', 5, ''),
  (20, '강예전로이을',      '서울', 5, ''),
  (7,  '송도달빛공원',     '인천', 5, ''),
  (16, '인천차이나타운',    '인천', 5, ''),
  (5,  '제주공항',         '제주', 4, '');

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users in handys.co.kr can read all
CREATE POLICY "read_branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_employees" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_history" ON status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_roles" ON user_roles FOR SELECT TO authenticated USING (true);

-- Policies: admin/editor can modify
CREATE POLICY "modify_branches" ON branches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE email = auth.jwt()->>'email' AND role IN ('admin','editor')));
CREATE POLICY "modify_employees" ON employees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE email = auth.jwt()->>'email' AND role IN ('admin','editor')));
CREATE POLICY "modify_history" ON status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE email = auth.jwt()->>'email' AND role IN ('admin','editor')));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for common queries
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_history_employee ON status_history(employee_id);
