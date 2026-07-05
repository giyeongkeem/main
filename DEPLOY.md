# 🚀 핏매치 공개 배포 가이드 (Supabase + Vercel)

이 문서대로 따라 하면 **누구나 접속 가능한 공개 URL**(예: `https://fitmatch-xxx.vercel.app`)이 생깁니다.
소요 시간은 약 15~20분이고, 두 서비스 모두 **무료 플랜**으로 충분합니다.

```
[방문자] ──> Vercel (Next.js 앱 실행) ──> Supabase (PostgreSQL: 데이터 / Storage: 업로드 이미지)
```

- 코드는 이미 배포 준비가 끝나 있습니다. `DATABASE_URL`만 설정하면 저장소가 자동으로 Postgres로 전환되고,
  첫 접속 시 테이블·샘플 데이터가 자동 생성됩니다.
- 업로드 사진은 Supabase **Storage**(설정 시, 권장) 또는 **DB**(미설정 시 자동 폴백)에 저장되어
  배포 환경에서도 관리자 사진 업로드가 그대로 동작합니다. (개당 4MB 제한)
- 소셜 로그인(카카오·네이버·애플)은 **선택**입니다 — 키를 넣은 제공자만 버튼이 활성화되고, 없어도 서비스는 정상 동작합니다.

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
6. *(권장 — 이미지 CDN 저장)* 왼쪽 메뉴 **Project Settings → API** 에서
   **Project URL**(`https://xxx.supabase.co`)과 **service_role 키**도 복사해 두세요.
   → 아래 STEP 2의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 값입니다.
   (건너뛰어도 됩니다 — 이미지가 DB에 저장되는 폴백으로 동작)

> ⚠️ 반드시 **Transaction pooler(포트 6543)** URI를 쓰세요.
> "Direct connection(5432)"은 Vercel(서버리스/IPv4) 환경에서 연결이 실패할 수 있습니다.

---

## STEP 2. Vercel — 앱 배포하기

1. [vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub**
2. 대시보드에서 **Add New… → Project**
3. 저장소 목록에서 `giyeongkeem/main` 찾아 **Import**
   (안 보이면 *Adjust GitHub App Permissions*에서 저장소 접근 허용)
4. 설정 화면에서 Framework가 **Next.js**로 자동 인식되는지 확인 (빌드 설정은 건드릴 필요 없음)
5. **Environment Variables** 섹션에 아래를 추가:

   **필수**

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | STEP 1에서 만든 Transaction pooler URI |
   | `ADMIN_PASSWORD` | 원하는 관리자 비밀번호 (admin1234 금지!) |
   | `ADMIN_SECRET` | 아무 긴 무작위 문자열 (예: 비밀번호 생성기로 40자) |
   | `AUTH_SECRET` | 아무 긴 무작위 문자열 (위와 다른 값) |

   **권장 (이미지를 CDN에 저장)**

   | Key | Value |
   | --- | --- |
   | `SUPABASE_URL` | STEP 1-6의 Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | STEP 1-6의 service_role 키 |

   **선택**

   | Key | 설명 |
   | --- | --- |
   | `SEED_SAMPLE_DATA` = `false` | 샘플 16개 없이 빈 상태로 시작 |
   | `AUTH_KAKAO_ID` / `AUTH_KAKAO_SECRET` | 카카오 로그인 (README의 “소셜 로그인 설정” 참고) |
   | `AUTH_NAVER_ID` / `AUTH_NAVER_SECRET` | 네이버 로그인 |
   | `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | 애플 로그인 (유료 멤버십 필요) |

   소셜 로그인 키는 나중에 추가해도 됩니다 — 추가한 제공자만 로그인 버튼이 활성화됩니다.

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
| 사진 업로드 500 에러 | `SUPABASE_SERVICE_ROLE_KEY` 오입력(anon 키와 혼동) 여부 확인 — *Settings → API*의 **service_role** 키여야 함 |
| 관리자 로그인이 안 됨 | `ADMIN_PASSWORD` 환경변수 확인 후 Vercel **Redeploy** (환경변수 변경은 재배포해야 반영) |
| 소셜 로그인 리다이렉트 오류 | 제공자 콘솔의 콜백 URL이 `https://<배포도메인>/api/auth/callback/<provider>` 와 정확히 일치하는지 확인 |

## 운영 팁

- **관리자 비밀번호는 길고 무작위하게**, `ADMIN_SECRET`·`AUTH_SECRET`도 반드시 변경하세요.
- 커스텀 도메인: Vercel → *Settings → Domains* 에서 연결 (예: fitmatch.kr) — 연결 후 소셜 로그인 콜백 URL도 새 도메인으로 갱신
- 이미지 저장 우선순위: **Supabase Storage(권장, CDN)** → 미설정 시 DB(bytea) → 로컬 파일.
  Storage 키만 넣으면 별도 코드 수정 없이 자동 전환됩니다.
