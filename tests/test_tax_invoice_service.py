"""tax_invoice_service 단위·API 테스트.

실행: python -m pytest tests/ -v   (또는 python tests/test_tax_invoice_service.py)
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 테스트 전용 임시 DB (import 전에 설정해야 함)
_tmp = tempfile.mkdtemp()
os.environ["TAX_INVOICE_DB"] = os.path.join(_tmp, "test.db")

from tax_invoice_service import db, nts  # noqa: E402
from tax_invoice_service.validation import (  # noqa: E402
    compute_totals,
    default_tax,
    is_valid_biz_no,
    validate_invoice,
)


def sample_invoice(**overrides) -> dict:
    data = {
        "write_date": "20260707",
        "tax_type": "과세",
        "purpose_type": "청구",
        "invoicer": {
            "corp_num": "1234567891",  # 체크섬 유효 (아래 테스트 참고)
            "corp_name": "테스트공급자(주)",
            "ceo_name": "김공급",
            "addr": "서울시 강남구 테헤란로 1",
            "biz_type": "서비스",
            "biz_class": "소프트웨어",
            "email": "seller@example.com",
        },
        "invoicee": {
            "type": "사업자",
            "corp_num": "2208162517",
            "corp_name": "테스트거래처(주)",
            "ceo_name": "이구매",
            "email": "buyer@example.com",
        },
        "items": [
            {"purchase_dt": "0707", "name": "개발용역", "qty": "1",
             "unit_cost": "1000000", "supply_cost": 1000000, "tax": 100000, "remark": ""},
        ],
        "remark": "",
    }
    data.update(overrides)
    return data


class ValidationTest(unittest.TestCase):
    def test_biz_no_checksum(self):
        self.assertTrue(is_valid_biz_no("123-45-67891"))
        self.assertTrue(is_valid_biz_no("220-81-62517"))   # 실존 형식 예시
        self.assertFalse(is_valid_biz_no("123-45-67890"))  # 체크 숫자 오류
        self.assertFalse(is_valid_biz_no("12345"))
        self.assertFalse(is_valid_biz_no(""))

    def test_default_tax(self):
        self.assertEqual(default_tax(1000000, "과세"), 100000)
        self.assertEqual(default_tax(999, "과세"), 99)  # 원 미만 절사
        self.assertEqual(default_tax(1000000, "영세"), 0)
        self.assertEqual(default_tax(1000000, "면세"), 0)

    def test_validate_ok(self):
        self.assertEqual(validate_invoice(sample_invoice()), [])

    def test_validate_errors(self):
        bad = sample_invoice(write_date="2026-07-07", tax_type="일반")
        bad["invoicer"]["corp_num"] = "111"
        bad["items"] = []
        errors = validate_invoice(bad)
        self.assertTrue(any("작성일자" in e for e in errors))
        self.assertTrue(any("과세형태" in e for e in errors))
        self.assertTrue(any("공급자 사업자등록번호" in e for e in errors))
        self.assertTrue(any("품목" in e for e in errors))

    def test_zero_rate_requires_zero_tax(self):
        bad = sample_invoice(tax_type="영세")
        errors = validate_invoice(bad)
        self.assertTrue(any("영세" in e for e in errors))

    def test_totals(self):
        totals = compute_totals([
            {"supply_cost": 1000, "tax": 100},
            {"supply_cost": 2000, "tax": 200},
        ])
        self.assertEqual(totals, {"supply_cost_total": 3000, "tax_total": 300,
                                  "total_amount": 3300})


class NtsTest(unittest.TestCase):
    def test_xml(self):
        inv = {**sample_invoice(), "mgt_key": "TI-20260707-000001",
               "nts_confirm_num": "", **compute_totals(sample_invoice()["items"])}
        xml = nts.invoice_to_xml(inv)
        self.assertIn("TaxInvoice", xml)
        self.assertIn("1234567891", xml)
        self.assertIn("테스트공급자(주)", xml)
        self.assertIn("1100000", xml)  # 합계금액
        self.assertIn("0101", xml)     # 과세 유형 코드

    def test_hometax_csv(self):
        inv = {**sample_invoice(), "mgt_key": "TI-20260707-000001",
               **compute_totals(sample_invoice()["items"])}
        csv_bytes = nts.invoices_to_hometax_csv([inv])
        text = csv_bytes.decode("utf-8-sig")
        lines = text.strip().splitlines()
        self.assertEqual(len(lines), 2)
        # 헤더와 데이터 행의 열 수가 같아야 한다
        import csv as _csv
        rows = list(_csv.reader(lines))
        self.assertEqual(len(rows[0]), len(rows[1]))
        self.assertIn("1234567891", text)
        self.assertIn("개발용역", text)


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from tax_invoice_service.web import app
        db.init_db()
        cls.client = TestClient(app)

    def test_full_flow(self):
        # 공급자 설정
        supplier = sample_invoice()["invoicer"]
        r = self.client.put("/api/supplier", json=supplier)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/supplier").json()["corp_name"],
                         "테스트공급자(주)")

        # 작성(임시저장) — 합계는 서버가 계산
        r = self.client.post("/api/invoices", json=sample_invoice())
        self.assertEqual(r.status_code, 200, r.text)
        inv = r.json()
        self.assertEqual(inv["status"], "draft")
        self.assertEqual(inv["total_amount"], 1100000)
        self.assertTrue(inv["mgt_key"].startswith("TI-20260707-"))

        # 거래처 자동 등록
        partners = self.client.get("/api/partners").json()
        self.assertTrue(any(p["corp_num"] == "2208162517" for p in partners))

        # 잘못된 입력 거부
        bad = sample_invoice()
        bad["invoicee"]["corp_num"] = "123"
        self.assertEqual(self.client.post("/api/invoices", json=bad).status_code, 422)

        # 팝빌 미설정 → 발급 시 400
        r = self.client.post(f"/api/invoices/{inv['id']}/issue")
        self.assertEqual(r.status_code, 400)

        # XML 다운로드
        r = self.client.get(f"/api/invoices/{inv['id']}/xml")
        self.assertEqual(r.status_code, 200)
        self.assertIn("TaxInvoice", r.text)

        # 홈택스 CSV
        r = self.client.get("/api/export/hometax.csv?status=draft")
        self.assertEqual(r.status_code, 200)
        self.assertIn("개발용역", r.content.decode("utf-8-sig"))

        # 수정 후 삭제
        updated = sample_invoice(remark="수정 테스트")
        r = self.client.put(f"/api/invoices/{inv['id']}", json=updated)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["remark"], "수정 테스트")
        self.assertEqual(self.client.delete(f"/api/invoices/{inv['id']}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/invoices/{inv['id']}").status_code, 404)

    def test_index_page(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("전자세금계산서", r.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
