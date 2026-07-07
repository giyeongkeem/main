"""전자세금계산서 발급 웹 서비스.

세금계산서 작성·관리 후 두 가지 경로로 국세청에 발급한다.

1. 팝빌(Popbill) API — POPBILL_LINK_ID / POPBILL_SECRET_KEY 설정 시
   웹 UI에서 즉시발급(발급 + 국세청 전송)까지 처리
2. 홈택스 일괄발급 CSV / 국세청 표준(v3.0) XML 내보내기 — API 없이
   홈택스(hometax.go.kr)에 직접 업로드하는 수동 경로

실행:
    python -m tax_invoice_service.web      # http://localhost:8080
"""

__version__ = "0.1.0"
