# 🚀 핏매치 공개 배포 가이드 (Supabase + Vercel)

이 문서대로 따라 하면 **누구나 접속 가능한 공개 URL**(예: `https://fitmatch-xxx.vercel.app`)이 생깁니다.
소요 시간은 약 15~20분이고, 두 서비스 모두 **무료 플랜**으로 충분합니다.

```
[방문자] ──> Vercel (Next.js 앱 실행)  ──>  Supabase (PostgreSQL — 데이터·업로드 이미지 저장)
```

- 코드는 이미 배포 준비가 끝나 있습니다. `DATABASE_URL`만 설정하면 저장소가 자동으로 Postgres로 전환되고,
  첫 접속 시 테이블·샘플 데이터가 자동 생성됩니다.
- 업로드 사진도 Postgres에 저장되므로 배포 환경에서 관리자 사진 업로드가 그대로 동작합니다. (개당 4MB 제한)

---

## STEP 0. 코드를 main 브랜치에 반영

현재 코드는 `claude/seoul-fitness-trainer-directory-z1syo5` 브랜치에 있습니다.
Vercel은 기본적으로 `main` 브랜치를 배포하므로, 둘 중 하나를 선택하세요.

**방법 A — main으로 병합 (권장, 장기적으로 깔끔)**
1. GitHub에서 저장소 `giyeongkeem/main` 접속
2. 상단에 뜨는 **"Compare & pull request"** 클릭 (안 보이면: *Pull requests → New pull request → base: `main` ← compare: `claude/seoul-fitness-trainer-directory-z1syo5`*)
3. **Create pull request** → **Merge pull request** → **Confirm merge**

**방법 B — Vercel에서 배포 브랜치만 변경 (병합 없이 바로)**
- Vercel 프로젝트 생성 후: *Settings → Git → Production Branch* 를
  `claude/seoul-fitness-trainer-directory-z1syo5` 로 변경 → Deployments에서 **Redeploy**

---

## STEP 1. Supabase — 데이터베이스 만들기

1. [supabase.com](https://supabase.com) → **Start your project** → GitHub로 가입/로그인
2. **New project** 클릭
   - Organization: 기본값
   - Project name: `fitmatch` (자유)
   - **Database Password: 영문+숫자로만** 만들기를 권장 (특수문자는 연결 문자열에서 인코딩 문제를 일으킬 수 있음). 꼭 보관하세요.
   - Region: **Northeast Asia (Seoul)** 선택
3. 생성 완료(1~2분)를 기다립니다.
4. 프로젝트 대시보드 **상단의 [Connect] 버튼** 클릭
   → **Transaction pooler** 탭 선택 → **URI** 복사
   ```
   postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   ```
5. `[YOUR-PASSWORD]` 부분을 2번에서 만든 비밀번호로 바꿔서 메모해 두세요.

> ⚠️ 반드시 **Transaction pooler(포트 6543)** URI를 쓰세요.
> "Direct connection(5432)"은 Vercel(서버리스/IPv4) 환경에서 연결이 실패할 수 있습니다.

---

## STEP 2. Vercel — 앱 배포하기

1. [vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub**
2. 대시보드에서 **Add New… → Project**
3. 저장소 목록에서 `giyeongkeem/main` 찾아 **Import**
   (안 보이면 *Adjust GitHub App Permissions*에서 저장소 접근 허용)
4. 설정 화면에서 Framework가 **Next.js**로 자동 인식되는지 확인 (빌드 설정은 건드릴 필요 없음)
5. **Environment Variables** 섹션에 아래 3개를 추가:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | STEP 1에서 만든 Transaction pooler URI |
   | `ADMIN_PASSWORD` | 원하는 관리자 비밀번호 (admin1234 금지!) |
   | `ADMIN_SECRET` | 아무 긴 무작위 문자열 (예: 비밀번호 생성기로 40자) |

   *(선택)* 샘플 데이터 16개 없이 빈 상태로 시작하려면 `SEED_SAMPLE_DATA` = `false` 추가

6. **Deploy** 클릭 → 1~2분 후 완료 화면에서 URL 확인 (`https://….vercel.app`)

---

## STEP 3. 배포 확인 체크리스트

배포된 URL에서 순서대로 확인하세요.

- [ ] 홈 접속 → 샘플 전문가들이 보임 (첫 접속은 시드 생성 때문에 몇 초 걸릴 수 있음)
- [ ] `/admin` → 설정한 `ADMIN_PASSWORD`로 로그인 → 콘솔 상단에 **“저장: PostgreSQL”** 표시 확인
- [ ] 관리자에서 아무 항목 수정 → 사진 업로드(4MB 이하) → 저장 → 사이트에 사진 표시
- [ ] `/register` 에서 테스트 신청 → 관리자 ‘승인 대기’에서 승인 → 사이트 노출
- [ ] 상세 페이지에서 후기 작성 → 평점 반영

## 이후 업데이트는?

`main` 브랜치에 push(또는 PR 머지)만 하면 **Vercel이 자동으로 재배포**합니다. 별도 작업 없음.

---

## 문제 해결

| 증상 | 원인/해결 |
| --- | --- |
| 페이지가 500 에러 | Vercel → 프로젝트 → *Logs* 확인. 대부분 `DATABASE_URL` 오타/비밀번호 문제 |
| `Tenant or user not found` | Direct(5432) URI를 쓴 경우 → **Transaction pooler(6543)** URI로 교체 |
| 비밀번호에 특수문자가 있어 연결 실패 | Supabase → *Settings → Database → Reset database password* 로 영숫자 비밀번호 재발급 |
| 한동안 접속 안 했더니 DB 오류 | Supabase 무료 플랜은 1주 미사용 시 일시정지 → 대시보드에서 **Restore/Resume** 클릭 |
| 사진 업로드 400 에러 | 4MB 초과 이미지 → 크기를 줄여 업로드 |
| 관리자 로그인이 안 됨 | `ADMIN_PASSWORD` 환경변수 확인 후 Vercel **Redeploy** (환경변수 변경은 재배포해야 반영) |

## 운영 팁

- **관리자 비밀번호는 길고 무작위하게**, `ADMIN_SECRET`도 반드시 변경하세요.
- 커스텀 도메인: Vercel → *Settings → Domains* 에서 연결 (예: fitmatch.kr)
- 사진이 수백 장 규모로 늘어나면 DB 용량(무료 500MB)을 아끼기 위해
  **Supabase Storage(CDN)** 로 이미지 저장을 옮기는 것을 권장합니다. (다음 단계 P2)
