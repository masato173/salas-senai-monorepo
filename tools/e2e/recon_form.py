"""
E2.3a (parte 2) — Reconhecimento do FORM aberto.
Os campos do ReservationForm só existem no DOM quando o form está aberto
(montagem condicional {showForm && ...}). O recon anterior viu 0 inputs
porque o form estava fechado.

Este script: navega → clica "Nova reserva" → espera o form → lista os campos.
Também testa o toggle Única/Período pra ver os campos de cada modo.

Zero ação destrutiva: abre o form e inspeciona, NÃO submete.
"""
from playwright.sync_api import sync_playwright

SCREENSHOT_PATH = "recon_form.png"
URL = "http://localhost:4173/reservas"


def list_fields(page, label):
    print(f"\n=== CAMPOS COM FORM {label} ===")
    inputs = page.locator("input, textarea, select").all()
    print(f"Encontrados {len(inputs)} campos:")
    for el in inputs:
        name = el.get_attribute("name") or el.get_attribute("id") or "[sem-nome]"
        itype = el.get_attribute("type") or el.evaluate("e => e.tagName.toLowerCase()")
        placeholder = el.get_attribute("placeholder") or ""
        # valor das options se for select
        extra = ""
        if itype == "select-one" or el.evaluate("e => e.tagName.toLowerCase()") == "select":
            opts = el.locator("option").all()
            extra = " opções=[" + ", ".join(
                (o.inner_text().strip() or o.get_attribute("value") or "") for o in opts[:8]
            ) + "]"
        print(f"  - {name} ({itype}) placeholder='{placeholder}'{extra}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    print(f"Navegando para {URL} ...")
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # Abre o form
    print("Clicando em 'Nova reserva' ...")
    page.get_by_role("button", name="Nova reserva").click()
    page.wait_for_timeout(1000)

    # Campos no modo padrão (provavelmente Única)
    list_fields(page, "ABERTO (modo padrão)")

    # Lista também os botões agora que o form está aberto (toggle, submit, etc.)
    print("\n=== BOTÕES COM FORM ABERTO ===")
    buttons = page.locator("button").all()
    for i, b in enumerate(buttons):
        try:
            text = b.inner_text().strip() if b.is_visible() else "[hidden]"
        except Exception:
            text = "[erro]"
        if text and text != "[hidden]":
            print(f"  [{i}] '{text}'")

    # Tenta achar o toggle de Período (texto pode variar)
    print("\n=== PROCURANDO TOGGLE ÚNICA/PERÍODO ===")
    for termo in ["Período", "Periodo", "Única", "Unica", "Range"]:
        loc = page.get_by_text(termo, exact=False)
        count = loc.count()
        if count > 0:
            print(f"  Texto '{termo}' encontrado ({count}x)")

    page.screenshot(path=SCREENSHOT_PATH, full_page=True)
    print(f"\nScreenshot salvo em: {SCREENSHOT_PATH}")

    browser.close()
    print("\nReconhecimento do form concluído.")
