"""팝빌(Popbill) 전자세금계산서 API 연동.

팝빌은 국세청 인증 전자세금계산서 ASP로, registIssue(즉시발급) 호출 시
발급과 국세청 전송까지 처리한다. 사용하려면:

1. popbill.com 가입 후 연동신청 → LinkID / SecretKey 발급
2. pip install popbill
3. 환경변수 설정
   POPBILL_LINK_ID=...        # 링크아이디
   POPBILL_SECRET_KEY=...     # 비밀키
   POPBILL_IS_TEST=true       # 테스트베드 여부(기본 true, 운영 전환 시 false)

환경변수가 없거나 popbill 패키지가 없으면 서비스는 수동 경로
(홈택스 CSV / 표준 XML 내보내기)만 제공한다.
"""

from __future__ import annotations

import os

try:
    from popbill import PopbillException, Taxinvoice, TaxinvoiceDetail, TaxinvoiceService
    _POPBILL_INSTALLED = True
except ImportError:
    _POPBILL_INSTALLED = False

from .validation import normalize_biz_no

LINK_ID = os.environ.get("POPBILL_LINK_ID", "")
SECRET_KEY = os.environ.get("POPBILL_SECRET_KEY", "")
IS_TEST = os.environ.get("POPBILL_IS_TEST", "true").lower() != "false"

_service = None


class PopbillNotConfigured(RuntimeError):
    pass


def is_configured() -> bool:
    return _POPBILL_INSTALLED and bool(LINK_ID and SECRET_KEY)


def status() -> dict:
    """설정 상태를 UI에 보여주기 위한 요약."""
    return {
        "installed": _POPBILL_INSTALLED,
        "configured": is_configured(),
        "is_test": IS_TEST,
    }


def _get_service():
    global _service
    if not _POPBILL_INSTALLED:
        raise PopbillNotConfigured(
            "popbill 패키지가 설치되어 있지 않습니다. `pip install popbill` 후 재시작하세요."
        )
    if not (LINK_ID and SECRET_KEY):
        raise PopbillNotConfigured(
            "POPBILL_LINK_ID / POPBILL_SECRET_KEY 환경변수가 설정되어 있지 않습니다."
        )
    if _service is None:
        svc = TaxinvoiceService(LINK_ID, SECRET_KEY)
        svc.IsTest = IS_TEST
        _service = svc
    return _service


def _to_popbill(invoice: dict) -> "Taxinvoice":
    """내부 세금계산서 dict를 팝빌 Taxinvoice 객체로 변환한다."""
    er, ee = invoice["invoicer"], invoice["invoicee"]
    details = [
        TaxinvoiceDetail(
            serialNum=i,
            purchaseDT=item.get("purchase_dt") or invoice["write_date"],
            itemName=item.get("name", ""),
            spec=item.get("spec", ""),
            qty=str(item.get("qty", "") or ""),
            unitCost=str(item.get("unit_cost", "") or ""),
            supplyCost=str(int(item.get("supply_cost", 0))),
            tax=str(int(item.get("tax", 0))),
            remark=item.get("remark", ""),
        )
        for i, item in enumerate(invoice["items"], 1)
    ]
    return Taxinvoice(
        writeDate=invoice["write_date"],
        chargeDirection="정과금",
        issueType="정발행",
        purposeType=invoice["purpose_type"],
        taxType=invoice["tax_type"],
        invoicerCorpNum=normalize_biz_no(er.get("corp_num", "")),
        invoicerTaxRegID=er.get("tax_reg_id", ""),
        invoicerMgtKey=invoice["mgt_key"],
        invoicerCorpName=er.get("corp_name", ""),
        invoicerCEOName=er.get("ceo_name", ""),
        invoicerAddr=er.get("addr", ""),
        invoicerBizType=er.get("biz_type", ""),
        invoicerBizClass=er.get("biz_class", ""),
        invoicerContactName=er.get("contact_name", ""),
        invoicerTEL=er.get("tel", ""),
        invoicerEmail=er.get("email", ""),
        invoicerSMSSendYN=False,
        invoiceeType=ee.get("type", "사업자"),
        invoiceeCorpNum=normalize_biz_no(ee.get("corp_num", "")),
        invoiceeTaxRegID=ee.get("tax_reg_id", ""),
        invoiceeCorpName=ee.get("corp_name", ""),
        invoiceeCEOName=ee.get("ceo_name", ""),
        invoiceeAddr=ee.get("addr", ""),
        invoiceeBizType=ee.get("biz_type", ""),
        invoiceeBizClass=ee.get("biz_class", ""),
        invoiceeContactName1=ee.get("contact_name", ""),
        invoiceeTEL1=ee.get("tel", ""),
        invoiceeEmail1=ee.get("email", ""),
        supplyCostTotal=str(invoice["supply_cost_total"]),
        taxTotal=str(invoice["tax_total"]),
        totalAmount=str(invoice["total_amount"]),
        remark1=invoice.get("remark", ""),
        detailList=details,
    )


def issue(invoice: dict, memo: str = "웹 서비스 즉시발급") -> dict:
    """즉시발급(registIssue): 발급과 국세청 전송을 한 번에 처리한다.

    성공 시 {"code", "message", "nts_confirm_num"}을 반환하고,
    실패 시 PopbillException 또는 PopbillNotConfigured를 던진다.
    """
    service = _get_service()
    corp_num = normalize_biz_no(invoice["invoicer"].get("corp_num", ""))
    result = service.registIssue(corp_num, _to_popbill(invoice), memo=memo)
    return {
        "code": getattr(result, "code", None),
        "message": getattr(result, "message", ""),
        "nts_confirm_num": getattr(result, "ntsConfirmNum", "") or "",
    }


def fetch_nts_status(invoice: dict) -> dict:
    """발급된 세금계산서의 국세청 전송 상태를 조회한다."""
    service = _get_service()
    corp_num = normalize_biz_no(invoice["invoicer"].get("corp_num", ""))
    info = service.getInfo(corp_num, "SELL", invoice["mgt_key"])
    return {
        "state_code": getattr(info, "stateCode", None),
        "nts_result": getattr(info, "ntsresult", "") or getattr(info, "ntsResult", "") or "",
        "nts_confirm_num": getattr(info, "ntsconfirmNum", "")
        or getattr(info, "ntsConfirmNum", "")
        or "",
        "nts_send_dt": getattr(info, "ntsSendDT", "") or "",
    }


def popbill_error_message(exc: Exception) -> str:
    """PopbillException을 사용자용 메시지로 변환한다."""
    if _POPBILL_INSTALLED and isinstance(exc, PopbillException):
        return f"팝빌 오류 [{exc.code}] {exc.message}"
    return str(exc)
