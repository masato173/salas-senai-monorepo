"""
e2e_calendar.py — Teste E2E do fluxo completo de reserva.
Controle de Salas SENAI.

Fluxo: criar reserva (Única, hoje) → aguardar evento no calendário →
       abrir modal e CONFIRMAR identidade pelo MARKER da observação →
       cancelar → confirmar que some.

ROBUSTEZ (Sprint 5 Frente 4 — conserto após Fase D):
- Sem fallback "primeiro evento". Se o evento da turma E2E-TST não aparecer,
  o teste FALHA com diagnóstico claro. NUNCA cancela reserva alheia.
- Identificação por MARKER único (E2E-HHMMSS) na observação, lido do modal
  ANTES de clicar em "Cancelar reserva". Blindagem contra residuais E2E-TST
  de runs antigos ou paralelos.
- wait_for_function pós-submit (timeout 8s) em vez de sleep fixo, robusto
  contra latência do Sheets.

Seletores confirmados via leitura do JSX de ReservationDetailsModal.tsx:
- Título da view details: "Detalhes da reserva"
- Observação: <dd> com text-content da observacao
- Botões: "Cancelar reserva" → "Confirmar cancelamento", "Fechar"

A reserva fica CANCELLED na planilha DEV (soft delete) — aceitável.
"""

import sys
import datetime
from playwright.sync_api import sync_playwright

URL = "http://localhost:4173/reservas"

SALA = "03 Sala"
TURMA = "E2E-TST"

# Horário único-ish por run
now = datetime.datetime.now()
start_h = now.hour
if start_h < 6:
    start_h = 6
elif start_h > 20:
    start_h = 20

START = f"{start_h:02d}:{now.minute:02d}"
END = f"{start_h + 1:02d}:{now.minute:02d}"
TODAY = now.strftime("%Y-%m-%d")

# MARKER único por run — vai pra observação e é a chave de identificação
MARKER = f"E2E-{now.strftime('%H%M%S')}"

FAILED = False


def check(cond, msg_ok, msg_fail):
    global FAILED
    if cond:
        print(f"  ✓ {msg_ok}")
    else:
        print(f"  ✗ FALHOU: {msg_fail}")
        FAILED = True


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    print(f"== E2E Calendário == data={TODAY} sala={SALA} horário={START}-{END} marker={MARKER}")

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # ---- PASSO 1: criar reserva única ----
    print("\n[1] Criando reserva única...")

    page.get_by_role("button", name="Nova reserva").click()
    page.wait_for_timeout(800)

    # Garante modo Única (default, mas tolerante)
    try:
        page.get_by_text("Única", exact=True).click(timeout=3000)
        page.wait_for_timeout(300)
    except Exception:
        print("    (modo 'Única' já ativo ou não-clicável — seguindo)")

    page.select_option("#sel-sala", label=SALA)
    page.fill("#sel-turma", TURMA)
    page.fill("#res-date", TODAY)
    page.fill("#res-start", START)
    page.fill("#res-end", END)
    page.fill("#res-reason", MARKER)
    page.wait_for_timeout(300)

    page.get_by_role("button", name="Solicitar reserva").click()

    print("    aguardando criação + refetch...")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # ---- PASSO 2: ESPERA ROBUSTA pelo evento no calendário ----
    print("\n[2] Aguardando evento aparecer no calendário (view Dia)...")
    page.get_by_role("button", name="Dia", exact=True).click()
    page.wait_for_timeout(1000)

    # Polling: espera até .fc-event contendo E2E-TST aparecer (8s timeout)
    try:
        page.wait_for_function(
            """(turma) => Array.from(document.querySelectorAll('.fc-event'))
                              .some(el => el.innerText.includes(turma))""",
            arg=TURMA,
            timeout=8000,
        )
    except Exception:
        print(f"  ✗ FALHOU: nenhum .fc-event com texto '{TURMA}' apareceu após 8s.")
        page.screenshot(path= "e2e_fail_no_event.png", full_page=True)
        browser.close()
        sys.exit(1)

    candidatos = page.locator(".fc-event", has_text=TURMA).all()
    print(f"    {len(candidatos)} candidato(s) com turma '{TURMA}' no calendário")

    # ---- PASSO 3: IDENTIFICAR pelo MARKER (blindagem) ----
    print(f"\n[3] Procurando candidato com observação='{MARKER}' (blindagem anti-residual)...")

    meu_evento_idx = None
    for idx, candidato in enumerate(candidatos):
        print(f"    abrindo candidato[{idx}]...")
        candidato.click()
        page.wait_for_timeout(800)

        # Modal abriu? confere título da view details
        if page.get_by_text("Detalhes da reserva").count() == 0:
            print(f"    candidato[{idx}]: modal não abriu — pulando.")
            continue

        # Lê o <dd> que contém o MARKER (observação)
        obs_matches = page.locator("dd", has_text=MARKER).count()
        if obs_matches > 0:
            print(f"    ✓ candidato[{idx}] tem MARKER='{MARKER}' — é o nosso.")
            meu_evento_idx = idx
            break  # modal já aberto no candidato certo

        # Não bateu — fecha modal e tenta próximo
        print(f"    candidato[{idx}]: sem MARKER — fechando modal.")
        page.get_by_role("button", name="Fechar").first.click()
        page.wait_for_timeout(500)

    if meu_evento_idx is None:
        print(f"  ✗ FALHOU: nenhum dos {len(candidatos)} candidatos tem MARKER='{MARKER}'.")
        print(f"    Isso pode significar: (a) a reserva criada não chegou ao calendário,")
        print(f"    ou (b) há residuais E2E-TST de runs antigos. NÃO cancelo nada — bug.")
        page.screenshot(path="e2e_fail_no_marker.png", full_page=True)
        browser.close()
        sys.exit(1)

    check(True, "evento da reserva identificado pelo MARKER no modal", "")

    # ---- PASSO 4: cancelar (2 cliques: Cancelar reserva → Confirmar cancelamento) ----
    print("\n[4] Cancelando...")

    page.get_by_role("button", name="Cancelar reserva").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Confirmar cancelamento").click()

    print("    aguardando cancelamento + refetch...")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # ---- PASSO 5: confirmar que o evento sumiu ----
    print("\n[5] Verificando que o evento sumiu...")
    page.get_by_role("button", name="Dia", exact=True).click()
    page.wait_for_timeout(1500)

    # Polling reverso: espera até NÃO ter mais .fc-event com E2E-TST (8s)
    sumiu = False
    try:
        page.wait_for_function(
            """(turma) => !Array.from(document.querySelectorAll('.fc-event'))
                                .some(el => el.innerText.includes(turma))""",
            arg=TURMA,
            timeout=8000,
        )
        sumiu = True
    except Exception:
        sumiu = False

    check(
        sumiu,
        "reserva cancelada sumiu do calendário",
        "reserva AINDA aparece após cancelar (refetch não atualizou ou cancel falhou)",
    )

    page.screenshot(path="e2e_final.png", full_page=True)
    browser.close()

# ---- Resultado ----
print("\n" + "=" * 40)
if FAILED:
    print("RESULTADO: ✗ FALHOU — ver screenshots e2e_*.png")
    sys.exit(1)
else:
    print("RESULTADO: ✓ PASSOU — fluxo criar→ver→identificar→cancelar→sumir OK")
    sys.exit(0)