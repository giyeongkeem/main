"""세금계산서 유효성 검증과 금액 계산.

부가가치세법 시행령 제67조의 필수 기재사항(공급자 등록번호·상호·성명,
공급받는자 등록번호, 작성연월일, 공급가액, 세액)을 기준으로 검증한다.
"""

from __future__ import annotations

import re
from datetime import datetime

# 사업자등록번호 검증 가중치 (국세청 체크섬 알고리즘)
_BIZ_NO_WEIGHTS = (1, 3, 7, 1, 3, 7, 1, 3, 5)

TAX_TYPES = ("과세", "영세", "면세")
PURPOSE_TYPES = ("영수", "청구")


def normalize_biz_no(value: str) -> str:
    """하이픈·공백을 제거한 10자리 숫자 문자열을 반환한다."""
    return re.sub(r"[^0-9]", "", value or "")


def is_valid_biz_no(value: str) -> bool:
    """사업자등록번호 체크섬을 검증한다."""
    digits = normalize_biz_no(value)
    if len(digits) != 10:
        return False
    nums = [int(c) for c in digits]
    total = sum(n * w for n, w in zip(nums, _BIZ_NO_WEIGHTS))
    total += (nums[8] * 5) // 10
    return (10 - total % 10) % 10 == nums[9]


def is_valid_write_date(value: str) -> bool:
    """작성일자(YYYYMMDD) 형식을 검증한다."""
    try:
        datetime.strptime(value or "", "%Y%m%d")
        return True
    except ValueError:
        return False


def default_tax(supply_cost: int, tax_type: str) -> int:
    """세액 기본값. 과세 10%(원 미만 절사), 영세·면세는 0원."""
    if tax_type == "과세":
        return supply_cost // 10 if supply_cost >= 0 else -((-supply_cost) // 10)
    return 0


def validate_invoice(data: dict) -> list[str]:
    """세금계산서 입력값을 검증하고 오류 메시지 목록을 반환한다(빈 목록이면 통과)."""
    errors: list[str] = []
    invoicer = data.get("invoicer") or {}
    invoicee = data.get("invoicee") or {}
    items = data.get("items") or []

    if not is_valid_write_date(data.get("write_date", "")):
        errors.append("작성일자는 YYYYMMDD 형식이어야 합니다.")
    if data.get("tax_type") not in TAX_TYPES:
        errors.append("과세형태는 과세/영세/면세 중 하나여야 합니다.")
    if data.get("purpose_type") not in PURPOSE_TYPES:
        errors.append("영수/청구 구분을 선택하세요.")

    if not is_valid_biz_no(invoicer.get("corp_num", "")):
        errors.append("공급자 사업자등록번호가 올바르지 않습니다.")
    if not (invoicer.get("corp_name") or "").strip():
        errors.append("공급자 상호는 필수입니다.")
    if not (invoicer.get("ceo_name") or "").strip():
        errors.append("공급자 대표자 성명은 필수입니다.")

    invoicee_type = invoicee.get("type", "사업자")
    if invoicee_type == "사업자":
        if not is_valid_biz_no(invoicee.get("corp_num", "")):
            errors.append("공급받는자 사업자등록번호가 올바르지 않습니다.")
    elif not normalize_biz_no(invoicee.get("corp_num", "")):
        errors.append("공급받는자 등록번호(주민등록번호 등)를 입력하세요.")
    if not (invoicee.get("corp_name") or "").strip():
        errors.append("공급받는자 상호는 필수입니다.")

    if not items:
        errors.append("품목을 1개 이상 입력하세요.")
    for i, item in enumerate(items, 1):
        if not (item.get("name") or "").strip():
            errors.append(f"품목 {i}: 품명은 필수입니다.")
        try:
            int(item.get("supply_cost", 0))
            int(item.get("tax", 0))
        except (TypeError, ValueError):
            errors.append(f"품목 {i}: 공급가액/세액은 정수(원)여야 합니다.")

    if data.get("tax_type") in ("영세", "면세"):
        try:
            if any(int(item.get("tax", 0)) != 0 for item in items):
                errors.append("영세·면세 세금계산서의 세액은 0원이어야 합니다.")
        except (TypeError, ValueError):
            pass

    return errors


def compute_totals(items: list[dict]) -> dict:
    """품목 합계(공급가액·세액·합계금액)를 계산한다."""
    supply = sum(int(item.get("supply_cost", 0)) for item in items)
    tax = sum(int(item.get("tax", 0)) for item in items)
    return {"supply_cost_total": supply, "tax_total": tax, "total_amount": supply + tax}
