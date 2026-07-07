"""국세청 관련 파일 생성.

- 전자세금계산서 표준(v3.0) 형식 XML: 국세청 표준 스키마
  (urn:kr:or:kec:standard:Tax) 구조를 따르는 문서를 생성한다.
  실제 국세청 제출본에는 공동인증서 전자서명(XML-DSig)이 필요하므로
  여기서 만든 XML은 검토·보관·타 시스템 연계용이다.
- 홈택스 일괄발급 CSV: 홈택스(hometax.go.kr) '전자세금계산서 일괄발급'
  엑셀 양식과 같은 열 순서로 내보낸다(엑셀 양식에 붙여넣어 업로드).
"""

from __future__ import annotations

import csv
import io
from xml.etree import ElementTree as ET
from xml.dom import minidom

from .validation import normalize_biz_no

_NS = "urn:kr:or:kec:standard:Tax:ReusableAggregateBusinessInformationEntitySchemaModule:1:0"

# 국세청 문서 유형 코드
_TYPE_CODES = {"과세": "0101", "영세": "0102", "면세": "0301"}
# 영수/청구 코드
_PURPOSE_CODES = {"영수": "01", "청구": "02"}


def _sub(parent: ET.Element, tag: str, text: str | int | None = None) -> ET.Element:
    el = ET.SubElement(parent, f"{{{_NS}}}{tag}")
    if text is not None:
        el.text = str(text)
    return el


def _party(parent: ET.Element, tag: str, party: dict) -> None:
    el = _sub(parent, tag)
    _sub(el, "ID", normalize_biz_no(party.get("corp_num", "")))
    if party.get("tax_reg_id"):
        _sub(el, "TaxRegistrationID", party["tax_reg_id"])
    _sub(el, "Name", party.get("corp_name", ""))
    person = _sub(el, "SpecifiedPerson")
    _sub(person, "Name", party.get("ceo_name", ""))
    if party.get("addr"):
        addr = _sub(el, "SpecifiedAddress")
        _sub(addr, "LineOneText", party["addr"])
    if party.get("biz_type") or party.get("biz_class"):
        _sub(el, "TypeInformation", party.get("biz_type", ""))
        _sub(el, "ClassificationInformation", party.get("biz_class", ""))
    if party.get("contact_name") or party.get("email") or party.get("tel"):
        contact = _sub(el, "DefinedContact")
        _sub(contact, "PersonName", party.get("contact_name", ""))
        if party.get("tel"):
            _sub(contact, "TelephoneCommunication", party["tel"])
        if party.get("email"):
            _sub(contact, "URICommunication", party["email"])


def invoice_to_xml(invoice: dict) -> str:
    """세금계산서를 국세청 표준(v3.0) 형식 XML 문자열로 변환한다."""
    ET.register_namespace("", _NS)
    root = ET.Element(f"{{{_NS}}}TaxInvoice")

    doc = _sub(root, "TaxInvoiceDocument")
    _sub(doc, "IssueID", invoice.get("nts_confirm_num") or invoice.get("mgt_key", ""))
    _sub(doc, "TypeCode", _TYPE_CODES.get(invoice["tax_type"], "0101"))
    _sub(doc, "IssueDateTime", invoice["write_date"])
    _sub(doc, "PurposeCode", _PURPOSE_CODES.get(invoice["purpose_type"], "02"))
    if invoice.get("remark"):
        _sub(doc, "DescriptionText", invoice["remark"])

    settlement = _sub(root, "TaxInvoiceTradeSettlement")
    _party(settlement, "InvoicerParty", invoice["invoicer"])
    _party(settlement, "InvoiceeParty", invoice["invoicee"])

    summation = _sub(settlement, "SpecifiedMonetarySummation")
    _sub(summation, "ChargeTotalAmount", invoice["supply_cost_total"])
    _sub(summation, "TaxTotalAmount", invoice["tax_total"])
    _sub(summation, "GrandTotalAmount", invoice["total_amount"])

    for i, item in enumerate(invoice["items"], 1):
        line = _sub(root, "TaxInvoiceTradeLineItem")
        _sub(line, "SequenceNumeric", i)
        if item.get("purchase_dt"):
            _sub(line, "PurchaseExpiryDateTime", item["purchase_dt"])
        _sub(line, "NameText", item.get("name", ""))
        if item.get("spec"):
            _sub(line, "InformationText", item["spec"])
        if item.get("qty"):
            _sub(line, "ChargeableUnitQuantity", item["qty"])
        if item.get("unit_cost"):
            _sub(line, "UnitPrice", item["unit_cost"])
        _sub(line, "InvoiceAmount", int(item.get("supply_cost", 0)))
        _sub(line, "TotalTax", int(item.get("tax", 0)))
        if item.get("remark"):
            _sub(line, "DescriptionText", item["remark"])

    raw = ET.tostring(root, encoding="unicode")
    pretty = minidom.parseString(raw).toprettyxml(indent="  ", encoding=None)
    return pretty


# 홈택스 일괄발급 양식 열 (품목 최대 4개)
_HOMETAX_HEADER = [
    "전자세금계산서 종류", "작성일자",
    "공급자 등록번호", "공급자 종사업장번호", "공급자 상호", "공급자 성명",
    "공급자 사업장주소", "공급자 업태", "공급자 종목", "공급자 이메일",
    "공급받는자 등록번호", "공급받는자 종사업장번호", "공급받는자 상호", "공급받는자 성명",
    "공급받는자 사업장주소", "공급받는자 업태", "공급받는자 종목",
    "공급받는자 이메일1", "공급받는자 이메일2",
    "공급가액", "세액", "비고",
] + [
    col
    for n in range(1, 5)
    for col in (f"일자{n}", f"품목{n}", f"규격{n}", f"수량{n}", f"단가{n}",
                f"공급가액{n}", f"세액{n}", f"품목비고{n}")
] + ["현금", "수표", "어음", "외상미수금", "영수(01)/청구(02)"]

# 홈택스 종류 코드: 01 일반, 02 영세율, (면세 계산서는 별도 양식)
_HOMETAX_KIND = {"과세": "01", "영세": "02", "면세": "01"}


def invoices_to_hometax_csv(invoices: list[dict]) -> bytes:
    """홈택스 일괄발급 양식 열 순서의 CSV(BOM 포함 UTF-8)를 생성한다.

    홈택스 업로드는 공식 엑셀 양식(.xls)만 허용하므로, 이 CSV의 데이터 행을
    홈택스에서 내려받은 양식에 붙여넣어 사용한다. 품목이 4개를 넘으면
    5번째부터는 잘리므로 별도 문서로 나눠 발급해야 한다.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_HOMETAX_HEADER)
    for inv in invoices:
        er, ee = inv["invoicer"], inv["invoicee"]
        row = [
            _HOMETAX_KIND.get(inv["tax_type"], "01"), inv["write_date"],
            normalize_biz_no(er.get("corp_num", "")), er.get("tax_reg_id", ""),
            er.get("corp_name", ""), er.get("ceo_name", ""), er.get("addr", ""),
            er.get("biz_type", ""), er.get("biz_class", ""), er.get("email", ""),
            normalize_biz_no(ee.get("corp_num", "")), ee.get("tax_reg_id", ""),
            ee.get("corp_name", ""), ee.get("ceo_name", ""), ee.get("addr", ""),
            ee.get("biz_type", ""), ee.get("biz_class", ""), ee.get("email", ""), "",
            inv["supply_cost_total"], inv["tax_total"], inv.get("remark", ""),
        ]
        items = (inv["items"] or [])[:4]
        for item in items:
            # 일자 열은 월일(MMDD) 4자리
            dt = (item.get("purchase_dt") or inv["write_date"])[-4:]
            row += [
                dt, item.get("name", ""), item.get("spec", ""),
                item.get("qty", ""), item.get("unit_cost", ""),
                int(item.get("supply_cost", 0)), int(item.get("tax", 0)),
                item.get("remark", ""),
            ]
        row += [""] * 8 * (4 - len(items))
        row += ["", "", "", "", _PURPOSE_CODES.get(inv["purpose_type"], "02")]
        writer.writerow(row)
    return ("\ufeff" + buf.getvalue()).encode("utf-8")
