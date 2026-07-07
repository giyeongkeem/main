"""전자세금계산서 발급 웹 서비스 (FastAPI).

로컬 실행:
    python -m tax_invoice_service.web        # http://localhost:8080

클라우드 배포 시(공개 URL): APP_PASSWORD 환경변수를 설정하면 접속에 비밀번호를
요구합니다(아이디는 아무 값, 비밀번호는 APP_PASSWORD). 사업자 정보가 저장되므로
배포 시 반드시 설정하세요.

팝빌 연동(국세청 전송)은 POPBILL_LINK_ID / POPBILL_SECRET_KEY 환경변수로 켭니다.
설정하지 않으면 홈택스 일괄발급 CSV·표준 XML 내보내기(수동 경로)만 동작합니다.
"""

from __future__ import annotations

import os
import secrets

from fastapi import Body, Depends, FastAPI, HTTPException, status
from fastapi.responses import HTMLResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from . import db, nts, popbill_client
from .validation import compute_totals, normalize_biz_no, validate_invoice

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

app = FastAPI(title="전자세금계산서 발급 서비스")

_basic = HTTPBasic(auto_error=False)


def require_auth(credentials: HTTPBasicCredentials | None = Depends(_basic)) -> None:
    """APP_PASSWORD가 설정된 경우에만 HTTP Basic 인증을 요구한다 (로컬은 무인증)."""
    if not APP_PASSWORD:
        return
    if credentials is None or not secrets.compare_digest(credentials.password, APP_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 필요합니다.",
            headers={"WWW-Authenticate": "Basic"},
        )


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


# ── 상태 · 설정 ───────────────────────────────────────────────────

@app.get("/api/status")
def api_status(_: None = Depends(require_auth)) -> dict:
    return {
        "popbill": popbill_client.status(),
        "counts": {s: len(db.list_invoices(s)) for s in db.STATUSES},
    }


@app.get("/api/supplier")
def get_supplier(_: None = Depends(require_auth)) -> dict:
    return db.get_setting("supplier", {}) or {}


@app.put("/api/supplier")
def put_supplier(payload: dict = Body(...), _: None = Depends(require_auth)) -> dict:
    db.put_setting("supplier", payload)
    return payload


# ── 거래처 ────────────────────────────────────────────────────────

@app.get("/api/partners")
def get_partners(_: None = Depends(require_auth)) -> list[dict]:
    return db.list_partners()


@app.delete("/api/partners/{partner_id}")
def remove_partner(partner_id: int, _: None = Depends(require_auth)) -> dict:
    if not db.delete_partner(partner_id):
        raise HTTPException(404, "거래처를 찾을 수 없습니다.")
    return {"deleted": True}


# ── 세금계산서 CRUD ───────────────────────────────────────────────

def _normalize_payload(payload: dict) -> dict:
    """입력값을 검증·정리하고 합계를 계산한다. 오류 시 422."""
    data = {
        "write_date": (payload.get("write_date") or "").strip(),
        "tax_type": payload.get("tax_type") or "과세",
        "purpose_type": payload.get("purpose_type") or "청구",
        "invoicer": payload.get("invoicer") or {},
        "invoicee": payload.get("invoicee") or {},
        "items": [
            {
                "purchase_dt": (item.get("purchase_dt") or "").strip(),
                "name": (item.get("name") or "").strip(),
                "spec": (item.get("spec") or "").strip(),
                "qty": item.get("qty") or "",
                "unit_cost": item.get("unit_cost") or "",
                "supply_cost": item.get("supply_cost") or 0,
                "tax": item.get("tax") or 0,
                "remark": (item.get("remark") or "").strip(),
            }
            for item in (payload.get("items") or [])
            if (item.get("name") or "").strip()
        ],
        "remark": (payload.get("remark") or "").strip(),
    }
    errors = validate_invoice(data)
    if errors:
        raise HTTPException(422, " / ".join(errors))
    data["items"] = [
        {**item, "supply_cost": int(item["supply_cost"]), "tax": int(item["tax"])}
        for item in data["items"]
    ]
    data.update(compute_totals(data["items"]))
    return data


@app.get("/api/invoices")
def get_invoices(status: str | None = None, _: None = Depends(require_auth)) -> list[dict]:
    if status and status not in db.STATUSES:
        raise HTTPException(422, f"status는 {db.STATUSES} 중 하나여야 합니다.")
    return db.list_invoices(status)


@app.post("/api/invoices")
def create_invoice(payload: dict = Body(...), _: None = Depends(require_auth)) -> dict:
    data = _normalize_payload(payload)
    invoice = db.create_invoice(data)
    # 공급받는자를 거래처로 자동 저장(다음 작성 시 자동완성)
    corp_num = normalize_biz_no(data["invoicee"].get("corp_num", ""))
    if corp_num:
        db.upsert_partner(corp_num, {k: v for k, v in data["invoicee"].items() if k != "corp_num"})
    return invoice


@app.get("/api/invoices/{invoice_id}")
def get_invoice(invoice_id: int, _: None = Depends(require_auth)) -> dict:
    invoice = db.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    return invoice


@app.put("/api/invoices/{invoice_id}")
def update_invoice(
    invoice_id: int, payload: dict = Body(...), _: None = Depends(require_auth)
) -> dict:
    existing = db.get_invoice(invoice_id)
    if not existing:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    if existing["status"] != "draft":
        raise HTTPException(409, "발급된 세금계산서는 수정할 수 없습니다. 수정세금계산서를 발급하세요.")
    data = _normalize_payload(payload)
    return db.update_invoice(invoice_id, data)


@app.delete("/api/invoices/{invoice_id}")
def remove_invoice(invoice_id: int, _: None = Depends(require_auth)) -> dict:
    existing = db.get_invoice(invoice_id)
    if not existing:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    if not db.delete_invoice(invoice_id):
        raise HTTPException(409, "발급된 세금계산서는 삭제할 수 없습니다.")
    return {"deleted": True}


# ── 발급 (팝빌 → 국세청) ─────────────────────────────────────────

@app.post("/api/invoices/{invoice_id}/issue")
def issue_invoice(invoice_id: int, _: None = Depends(require_auth)) -> dict:
    invoice = db.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    if invoice["status"] != "draft":
        raise HTTPException(409, "임시저장 상태의 세금계산서만 발급할 수 있습니다.")
    try:
        result = popbill_client.issue(invoice)
    except popbill_client.PopbillNotConfigured as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        db.set_invoice_status(invoice_id, "failed", nts_result=popbill_client.popbill_error_message(e))
        raise HTTPException(502, popbill_client.popbill_error_message(e))
    new_status = "sent" if result["nts_confirm_num"] else "issued"
    db.set_invoice_status(
        invoice_id, new_status,
        nts_confirm_num=result["nts_confirm_num"],
        nts_result=result.get("message", ""),
        issued=True,
    )
    return db.get_invoice(invoice_id)


@app.post("/api/invoices/{invoice_id}/refresh")
def refresh_invoice(invoice_id: int, _: None = Depends(require_auth)) -> dict:
    """팝빌에서 국세청 전송 상태를 다시 조회해 반영한다."""
    invoice = db.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    if invoice["status"] not in ("issued", "sent", "failed"):
        raise HTTPException(409, "발급된 세금계산서만 상태를 조회할 수 있습니다.")
    try:
        info = popbill_client.fetch_nts_status(invoice)
    except popbill_client.PopbillNotConfigured as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, popbill_client.popbill_error_message(e))
    new_status = invoice["status"]
    if info["nts_confirm_num"]:
        new_status = "sent"
    elif (info["nts_result"] or "").startswith("실패") or info["nts_result"] in ("ERR",):
        new_status = "failed"
    db.set_invoice_status(
        invoice_id, new_status,
        nts_confirm_num=info["nts_confirm_num"] or None,
        nts_result=info["nts_result"] or None,
    )
    return db.get_invoice(invoice_id)


# ── 내보내기 (수동 경로) ─────────────────────────────────────────

@app.get("/api/invoices/{invoice_id}/xml")
def download_xml(invoice_id: int, _: None = Depends(require_auth)) -> Response:
    invoice = db.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(404, "세금계산서를 찾을 수 없습니다.")
    xml = nts.invoice_to_xml(invoice)
    return Response(
        content=xml,
        media_type="application/xml; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{invoice["mgt_key"]}.xml"'},
    )


@app.get("/api/export/hometax.csv")
def export_hometax(
    ids: str | None = None, status: str | None = None, _: None = Depends(require_auth)
) -> Response:
    if ids:
        invoices = [inv for i in ids.split(",") if (inv := db.get_invoice(int(i)))]
    else:
        invoices = db.list_invoices(status or "draft")
    if not invoices:
        raise HTTPException(404, "내보낼 세금계산서가 없습니다.")
    csv_bytes = nts.invoices_to_hometax_csv(invoices)
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="hometax_bulk_issue.csv"'},
    )


# ── 웹 UI ─────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def index(_: None = Depends(require_auth)) -> str:
    return INDEX_HTML


INDEX_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>전자세금계산서 발급 서비스</title>
<style>
  :root { --blue:#1a5fb4; --bg:#f4f6f9; --line:#dde3ea; --muted:#6b7684; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif; background:var(--bg); color:#222; }
  header { background:var(--blue); color:#fff; padding:14px 24px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-size:18px; margin:0; }
  #popbill-badge { font-size:12px; padding:3px 10px; border-radius:12px; background:rgba(255,255,255,.2); }
  nav { display:flex; gap:4px; background:#fff; border-bottom:1px solid var(--line); padding:0 16px; }
  nav button { border:0; background:none; padding:12px 18px; font-size:14px; cursor:pointer; color:var(--muted); border-bottom:2px solid transparent; }
  nav button.active { color:var(--blue); border-bottom-color:var(--blue); font-weight:700; }
  main { max-width:1080px; margin:0 auto; padding:20px 16px 60px; }
  section.card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px; margin-bottom:16px; }
  h2 { font-size:15px; margin:0 0 14px; color:var(--blue); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px 14px; }
  label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--muted); }
  input, select, textarea { padding:8px 10px; border:1px solid var(--line); border-radius:6px; font-size:14px; font-family:inherit; }
  input:focus, select:focus { outline:2px solid #bcd3f2; border-color:var(--blue); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { border:1px solid var(--line); padding:7px 8px; text-align:left; }
  th { background:#f0f4f9; font-weight:600; white-space:nowrap; }
  td input { width:100%; border:1px solid transparent; padding:4px 6px; }
  td input:hover { border-color:var(--line); }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .btn { display:inline-block; border:1px solid var(--line); background:#fff; border-radius:6px; padding:8px 14px; font-size:13px; cursor:pointer; }
  .btn.primary { background:var(--blue); border-color:var(--blue); color:#fff; font-weight:700; }
  .btn.danger { color:#c01c28; border-color:#e0b4b4; }
  .btn.small { padding:4px 9px; font-size:12px; }
  .btn:disabled { opacity:.45; cursor:not-allowed; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .totals { display:flex; gap:24px; justify-content:flex-end; font-size:14px; margin-top:10px; }
  .totals b { font-variant-numeric:tabular-nums; }
  .status { font-size:12px; padding:2px 8px; border-radius:10px; white-space:nowrap; }
  .status.draft  { background:#eee; color:#555; }
  .status.issued { background:#fdf0d5; color:#a06000; }
  .status.sent   { background:#ddf5dd; color:#1b7d2c; }
  .status.failed { background:#fbdfdf; color:#c01c28; }
  #msg { position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:10px 20px; border-radius:8px; font-size:13px; display:none; max-width:90%; z-index:50; }
  .muted { color:var(--muted); font-size:12px; }
  dialog { border:1px solid var(--line); border-radius:10px; max-width:760px; width:92%; padding:0; }
  dialog .body { padding:20px; max-height:75vh; overflow:auto; }
  dialog h3 { margin-top:0; color:var(--blue); }
  .kv { display:grid; grid-template-columns:130px 1fr; gap:4px 10px; font-size:13px; margin-bottom:12px; }
  .kv dt { color:var(--muted); } .kv dd { margin:0; }
</style>
</head>
<body>
<header>
  <h1>전자세금계산서 발급 서비스</h1>
  <span id="popbill-badge">연동 확인 중…</span>
</header>
<nav>
  <button data-tab="compose" class="active">세금계산서 작성</button>
  <button data-tab="list">발급 목록</button>
  <button data-tab="partners">거래처</button>
  <button data-tab="settings">설정</button>
</nav>
<main>

<!-- ── 작성 탭 ── -->
<div id="tab-compose">
  <section class="card">
    <h2>기본 정보</h2>
    <div class="grid">
      <label>작성일자 <input type="date" id="f-write-date"></label>
      <label>과세형태
        <select id="f-tax-type"><option>과세</option><option>영세</option><option>면세</option></select>
      </label>
      <label>영수/청구
        <select id="f-purpose"><option>청구</option><option>영수</option></select>
      </label>
    </div>
  </section>

  <section class="card">
    <h2>공급자 (내 사업자)</h2>
    <p class="muted">설정 탭에 저장해 두면 자동으로 채워집니다.</p>
    <div class="grid" id="invoicer-grid"></div>
  </section>

  <section class="card">
    <h2>공급받는자 (거래처)</h2>
    <div class="row" style="margin-bottom:10px">
      <select id="partner-select" style="min-width:260px"><option value="">거래처 선택(자동 입력)…</option></select>
    </div>
    <div class="grid" id="invoicee-grid"></div>
  </section>

  <section class="card">
    <h2>품목</h2>
    <table id="items-table">
      <thead><tr>
        <th style="width:90px">월일</th><th>품명</th><th style="width:80px">규격</th>
        <th style="width:70px">수량</th><th style="width:110px">단가</th>
        <th style="width:120px">공급가액</th><th style="width:100px">세액</th>
        <th style="width:90px">비고</th><th style="width:40px"></th>
      </tr></thead>
      <tbody></tbody>
    </table>
    <div class="row" style="margin-top:10px; justify-content:space-between">
      <button class="btn small" onclick="addItemRow()">+ 품목 추가</button>
      <div class="totals">
        <span>공급가액 <b id="t-supply">0</b>원</span>
        <span>세액 <b id="t-tax">0</b>원</span>
        <span>합계 <b id="t-total">0</b>원</span>
      </div>
    </div>
    <label style="margin-top:12px">비고 <input id="f-remark" placeholder="비고 (선택)"></label>
  </section>

  <div class="row" style="justify-content:flex-end">
    <button class="btn" onclick="saveDraft(false)">임시저장</button>
    <button class="btn primary" onclick="saveDraft(true)">저장 후 국세청 발급</button>
  </div>
  <p class="muted" style="text-align:right">
    팝빌 미연동 시에는 임시저장 후 <b>발급 목록 → 홈택스 CSV 내려받기</b>로
    홈택스 일괄발급 양식에 붙여넣어 발급하세요.
  </p>
</div>

<!-- ── 목록 탭 ── -->
<div id="tab-list" style="display:none">
  <section class="card">
    <div class="row" style="justify-content:space-between; margin-bottom:12px">
      <div class="row">
        <select id="list-filter" onchange="loadInvoices()">
          <option value="">전체</option>
          <option value="draft">임시저장</option>
          <option value="issued">발급완료(전송대기)</option>
          <option value="sent">국세청 전송완료</option>
          <option value="failed">실패</option>
        </select>
      </div>
      <div class="row">
        <button class="btn small" onclick="exportCsv()">홈택스 일괄발급 CSV (임시저장분)</button>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>문서번호</th><th>작성일자</th><th>공급받는자</th>
        <th class="num">합계금액</th><th>상태</th><th>국세청 승인번호</th><th style="width:230px">작업</th>
      </tr></thead>
      <tbody id="invoice-rows"></tbody>
    </table>
  </section>
</div>

<!-- ── 거래처 탭 ── -->
<div id="tab-partners" style="display:none">
  <section class="card">
    <h2>거래처 목록</h2>
    <p class="muted">세금계산서를 저장하면 공급받는자가 자동으로 등록됩니다.</p>
    <table>
      <thead><tr><th>사업자등록번호</th><th>상호</th><th>대표자</th><th>이메일</th><th style="width:60px"></th></tr></thead>
      <tbody id="partner-rows"></tbody>
    </table>
  </section>
</div>

<!-- ── 설정 탭 ── -->
<div id="tab-settings" style="display:none">
  <section class="card">
    <h2>공급자 (내 사업자) 정보</h2>
    <div class="grid" id="supplier-grid"></div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" onclick="saveSupplier()">저장</button>
    </div>
  </section>
  <section class="card">
    <h2>국세청 전송 연동 (팝빌)</h2>
    <div id="popbill-info" class="muted"></div>
  </section>
</div>

</main>

<dialog id="detail-dialog"><div class="body" id="detail-body"></div></dialog>
<div id="msg"></div>

<script>
const PARTY_FIELDS = [
  ["corp_num","사업자등록번호 *","000-00-00000"],
  ["corp_name","상호(법인명) *",""],
  ["ceo_name","대표자 성명 *",""],
  ["tax_reg_id","종사업장번호",""],
  ["addr","사업장 주소",""],
  ["biz_type","업태",""],
  ["biz_class","종목",""],
  ["contact_name","담당자",""],
  ["tel","전화번호",""],
  ["email","이메일",""],
];

function fmt(n){ return Number(n||0).toLocaleString("ko-KR"); }
function msg(text){ const el=document.getElementById("msg"); el.textContent=text; el.style.display="block";
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.display="none", 4000); }
async function api(path, opts={}){
  const res = await fetch(path, {headers:{"Content-Type":"application/json"}, ...opts});
  if(!res.ok){ const body = await res.json().catch(()=>({detail:res.statusText}));
    throw new Error(body.detail || res.statusText); }
  return res.headers.get("content-type")?.includes("json") ? res.json() : res;
}

// ── 탭 ──
document.querySelectorAll("nav button").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active", b===btn));
  ["compose","list","partners","settings"].forEach(t=>
    document.getElementById("tab-"+t).style.display = btn.dataset.tab===t ? "" : "none");
  if(btn.dataset.tab==="list") loadInvoices();
  if(btn.dataset.tab==="partners") loadPartnerTable();
});

// ── 당사자 입력 그리드 ──
function renderPartyGrid(containerId, prefix){
  const grid = document.getElementById(containerId);
  grid.innerHTML = PARTY_FIELDS.map(([key,label,ph])=>
    `<label>${label}<input id="${prefix}-${key}" placeholder="${ph}"></label>`).join("");
}
function readParty(prefix){
  const party = {};
  PARTY_FIELDS.forEach(([key])=>party[key]=document.getElementById(`${prefix}-${key}`).value.trim());
  return party;
}
function fillParty(prefix, data){
  PARTY_FIELDS.forEach(([key])=>{
    document.getElementById(`${prefix}-${key}`).value = (data && data[key]) || ""; });
}
renderPartyGrid("invoicer-grid","er");
renderPartyGrid("invoicee-grid","ee");
renderPartyGrid("supplier-grid","sp");

// ── 품목 ──
function addItemRow(item={}){
  const tbody = document.querySelector("#items-table tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="i-dt" placeholder="MMDD" value="${item.purchase_dt||""}"></td>
    <td><input class="i-name" value="${item.name||""}"></td>
    <td><input class="i-spec" value="${item.spec||""}"></td>
    <td><input class="i-qty num" value="${item.qty||""}"></td>
    <td><input class="i-unit num" value="${item.unit_cost||""}"></td>
    <td><input class="i-supply num" value="${item.supply_cost||""}"></td>
    <td><input class="i-tax num" value="${item.tax??""}"></td>
    <td><input class="i-remark" value="${item.remark||""}"></td>
    <td style="text-align:center"><button class="btn small danger" onclick="this.closest('tr').remove();recalc()">×</button></td>`;
  tbody.appendChild(tr);
  // 수량×단가 → 공급가액, 공급가액×10% → 세액(과세, 원 미만 절사) 자동 계산
  const qty=tr.querySelector(".i-qty"), unit=tr.querySelector(".i-unit"),
        supply=tr.querySelector(".i-supply"), tax=tr.querySelector(".i-tax");
  function autoSupply(){
    const q=parseFloat(qty.value), u=parseFloat(unit.value);
    if(!isNaN(q)&&!isNaN(u)) supply.value = Math.floor(q*u);
    autoTax();
  }
  function autoTax(){
    const s=parseInt(supply.value);
    tax.value = (document.getElementById("f-tax-type").value==="과세" && !isNaN(s))
      ? Math.floor(s/10) : 0;
    recalc();
  }
  qty.addEventListener("input", autoSupply);
  unit.addEventListener("input", autoSupply);
  supply.addEventListener("input", autoTax);
  tax.addEventListener("input", recalc);
}
function readItems(){
  return [...document.querySelectorAll("#items-table tbody tr")].map(tr=>({
    purchase_dt: tr.querySelector(".i-dt").value.trim(),
    name: tr.querySelector(".i-name").value.trim(),
    spec: tr.querySelector(".i-spec").value.trim(),
    qty: tr.querySelector(".i-qty").value.trim(),
    unit_cost: tr.querySelector(".i-unit").value.trim(),
    supply_cost: parseInt(tr.querySelector(".i-supply").value)||0,
    tax: parseInt(tr.querySelector(".i-tax").value)||0,
    remark: tr.querySelector(".i-remark").value.trim(),
  })).filter(item=>item.name);
}
function recalc(){
  const items = readItems();
  const supply = items.reduce((a,i)=>a+i.supply_cost,0);
  const tax = items.reduce((a,i)=>a+i.tax,0);
  document.getElementById("t-supply").textContent = fmt(supply);
  document.getElementById("t-tax").textContent = fmt(tax);
  document.getElementById("t-total").textContent = fmt(supply+tax);
}
document.getElementById("f-tax-type").addEventListener("change", ()=>{
  document.querySelectorAll("#items-table tbody tr .i-supply")
    .forEach(el=>el.dispatchEvent(new Event("input")));
});
addItemRow();

// ── 작성/저장 ──
function readForm(){
  return {
    write_date: document.getElementById("f-write-date").value.replaceAll("-",""),
    tax_type: document.getElementById("f-tax-type").value,
    purpose_type: document.getElementById("f-purpose").value,
    invoicer: readParty("er"),
    invoicee: {...readParty("ee"), type:"사업자"},
    items: readItems(),
    remark: document.getElementById("f-remark").value.trim(),
  };
}
async function saveDraft(andIssue){
  try{
    const invoice = await api("/api/invoices", {method:"POST", body:JSON.stringify(readForm())});
    if(andIssue){
      const issued = await api(`/api/invoices/${invoice.id}/issue`, {method:"POST"});
      msg(issued.status==="sent"
        ? `국세청 전송 완료 (승인번호 ${issued.nts_confirm_num})`
        : "발급 완료 — 국세청 전송 대기 중입니다. 목록에서 상태를 갱신하세요.");
    } else {
      msg(`임시저장 완료 (문서번호 ${invoice.mgt_key})`);
    }
    document.querySelector("#items-table tbody").innerHTML=""; addItemRow(); recalc();
    document.getElementById("f-remark").value="";
    loadPartners();
  }catch(e){ msg("오류: "+e.message); }
}

// ── 목록 ──
const STATUS_KO = {draft:"임시저장", issued:"발급완료", sent:"전송완료", failed:"실패"};
async function loadInvoices(){
  const filter = document.getElementById("list-filter").value;
  const rows = await api("/api/invoices"+(filter?`?status=${filter}`:""));
  document.getElementById("invoice-rows").innerHTML = rows.map(inv=>`
    <tr>
      <td>${inv.mgt_key}</td>
      <td>${inv.write_date}</td>
      <td>${inv.invoicee.corp_name||""}</td>
      <td class="num">${fmt(inv.total_amount)}원</td>
      <td><span class="status ${inv.status}">${STATUS_KO[inv.status]||inv.status}</span></td>
      <td>${inv.nts_confirm_num||"-"}</td>
      <td>
        <button class="btn small" onclick="showDetail(${inv.id})">상세</button>
        ${inv.status==="draft" ? `
          <button class="btn small primary" onclick="issueInvoice(${inv.id})">국세청 발급</button>
          <button class="btn small danger" onclick="deleteInvoice(${inv.id})">삭제</button>` : `
          <button class="btn small" onclick="refreshInvoice(${inv.id})">상태 갱신</button>`}
        <a class="btn small" href="/api/invoices/${inv.id}/xml">XML</a>
      </td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted">세금계산서가 없습니다.</td></tr>`;
}
async function issueInvoice(id){
  if(!confirm("이 세금계산서를 발급하고 국세청에 전송할까요?\n발급 후에는 수정·삭제할 수 없습니다.")) return;
  try{ const inv = await api(`/api/invoices/${id}/issue`, {method:"POST"});
    msg(inv.status==="sent" ? `국세청 전송 완료 (승인번호 ${inv.nts_confirm_num})` : "발급 완료 — 전송 대기");
    loadInvoices();
  }catch(e){ msg("오류: "+e.message); loadInvoices(); }
}
async function refreshInvoice(id){
  try{ const inv = await api(`/api/invoices/${id}/refresh`, {method:"POST"});
    msg(`상태: ${STATUS_KO[inv.status]} ${inv.nts_result||""}`); loadInvoices();
  }catch(e){ msg("오류: "+e.message); }
}
async function deleteInvoice(id){
  if(!confirm("임시저장 문서를 삭제할까요?")) return;
  try{ await api(`/api/invoices/${id}`, {method:"DELETE"}); loadInvoices(); }
  catch(e){ msg("오류: "+e.message); }
}
function exportCsv(){ location.href = "/api/export/hometax.csv?status=draft"; }
async function showDetail(id){
  const inv = await api(`/api/invoices/${id}`);
  const dlg = document.getElementById("detail-dialog");
  document.getElementById("detail-body").innerHTML = `
    <h3>세금계산서 ${inv.mgt_key}</h3>
    <dl class="kv">
      <dt>상태</dt><dd><span class="status ${inv.status}">${STATUS_KO[inv.status]}</span> ${inv.nts_result||""}</dd>
      <dt>국세청 승인번호</dt><dd>${inv.nts_confirm_num||"-"}</dd>
      <dt>작성일자</dt><dd>${inv.write_date} · ${inv.tax_type} · ${inv.purpose_type}</dd>
      <dt>공급자</dt><dd>${inv.invoicer.corp_name} (${inv.invoicer.corp_num}) ${inv.invoicer.ceo_name}</dd>
      <dt>공급받는자</dt><dd>${inv.invoicee.corp_name} (${inv.invoicee.corp_num}) ${inv.invoicee.ceo_name||""}</dd>
      <dt>합계</dt><dd>공급가액 ${fmt(inv.supply_cost_total)}원 + 세액 ${fmt(inv.tax_total)}원 =
        <b>${fmt(inv.total_amount)}원</b></dd>
      ${inv.remark?`<dt>비고</dt><dd>${inv.remark}</dd>`:""}
    </dl>
    <table><thead><tr><th>월일</th><th>품명</th><th>규격</th><th>수량</th><th>단가</th>
      <th class="num">공급가액</th><th class="num">세액</th></tr></thead>
    <tbody>${inv.items.map(i=>`<tr><td>${i.purchase_dt||""}</td><td>${i.name}</td><td>${i.spec||""}</td>
      <td>${i.qty||""}</td><td class="num">${i.unit_cost?fmt(i.unit_cost):""}</td>
      <td class="num">${fmt(i.supply_cost)}</td><td class="num">${fmt(i.tax)}</td></tr>`).join("")}</tbody></table>
    <div class="row" style="justify-content:flex-end; margin-top:14px">
      <button class="btn" onclick="document.getElementById('detail-dialog').close()">닫기</button>
    </div>`;
  dlg.showModal();
}

// ── 거래처 ──
async function loadPartners(){
  const partners = await api("/api/partners");
  document.getElementById("partner-select").innerHTML =
    `<option value="">거래처 선택(자동 입력)…</option>` +
    partners.map((p,i)=>`<option value="${i}">${p.corp_name} (${p.corp_num})</option>`).join("");
  window._partners = partners;
}
document.getElementById("partner-select").addEventListener("change", e=>{
  const p = window._partners?.[e.target.value];
  if(p) fillParty("ee", p);
});
async function loadPartnerTable(){
  const partners = await api("/api/partners");
  document.getElementById("partner-rows").innerHTML = partners.map(p=>`
    <tr><td>${p.corp_num}</td><td>${p.corp_name||""}</td><td>${p.ceo_name||""}</td><td>${p.email||""}</td>
    <td><button class="btn small danger" onclick="deletePartner(${p.id})">삭제</button></td></tr>`).join("")
    || `<tr><td colspan="5" class="muted">등록된 거래처가 없습니다.</td></tr>`;
}
async function deletePartner(id){
  await api(`/api/partners/${id}`, {method:"DELETE"});
  loadPartnerTable(); loadPartners();
}

// ── 설정 ──
async function loadSupplier(){
  const sp = await api("/api/supplier");
  fillParty("sp", sp); fillParty("er", sp);
}
async function saveSupplier(){
  const sp = readParty("sp");
  await api("/api/supplier", {method:"PUT", body:JSON.stringify(sp)});
  fillParty("er", sp);
  msg("공급자 정보를 저장했습니다.");
}

// ── 초기화 ──
(async function init(){
  const today = new Date();
  document.getElementById("f-write-date").value = today.toISOString().slice(0,10);
  try{
    const st = await api("/api/status");
    const pb = st.popbill;
    const badge = document.getElementById("popbill-badge");
    badge.textContent = pb.configured
      ? `팝빌 연동됨 (${pb.is_test ? "테스트베드" : "운영"})`
      : "팝빌 미연동 — 홈택스 수동 발급 모드";
    document.getElementById("popbill-info").innerHTML = pb.configured
      ? `<p>팝빌 API가 연동되어 있습니다. <b>${pb.is_test ? "테스트베드" : "운영"}</b> 환경으로
         국세청 전송이 ${pb.is_test ? "모의 처리됩니다(실제 신고 아님)" : "실제로 이루어집니다"}.</p>`
      : `<p>팝빌 미연동 상태입니다. 국세청 자동 전송을 사용하려면:</p>
         <ol><li><a href="https://www.popbill.com" target="_blank">popbill.com</a> 가입 → 연동신청 → LinkID/SecretKey 발급</li>
         <li><code>pip install popbill</code> ${pb.installed ? "(설치됨 ✓)" : "(미설치)"}</li>
         <li>환경변수 <code>POPBILL_LINK_ID</code>, <code>POPBILL_SECRET_KEY</code>,
             <code>POPBILL_IS_TEST</code> 설정 후 서버 재시작</li></ol>
         <p>미연동 상태에서도 <b>홈택스 일괄발급 CSV</b>와 <b>표준 XML</b>로 수동 발급이 가능합니다.</p>`;
  }catch(e){ /* 배지 갱신 실패는 무시 */ }
  loadSupplier(); loadPartners();
})();
</script>
</body>
</html>"""


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
