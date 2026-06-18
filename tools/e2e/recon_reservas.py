"""
E2.3a — Reconhecimento da página /reservas (Controle de Salas SENAI).
Segue o padrão element_discovery.py da skill webapp-testing.

Navega, espera networkidle, e lista botões/inputs/eventos do calendário
pra a gente descobrir os seletores REAIS antes de escrever o teste de fluxo.

NÃO faz nenhuma ação destrutiva — só inspeciona e tira screenshot.
"""
from playwright.sync_api import sync_playwright

# Pasta local pro screenshot (Windows não tem /tmp)
SCREENSHOT_PATH = "recon_reservas.png"

# A app serve em 4173 (vite preview). Ajusta a rota se /reservas tiver prefixo.
URL = "http://localhost:4173/reservas"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    print(f"Navegando para {URL} ...")
    page.goto(URL)
    # CRÍTICO: espera o JS executar e o FullCalendar montar + o fetch de reservas
    page.wait_for_load_state("networkidle")
    # Margem extra pro FullCalendar renderizar os eventos após o fetch
    page.wait_for_timeout(2000)

    print("\n=== BOTÕES ===")
    buttons = page.locator("button").all()
    print(f"Encontrados {len(buttons)} botões:")
    for i, b in enumerate(buttons):
        try:
            text = b.inner_text().strip() if b.is_visible() else "[hidden]"
        except Exception:
            text = "[erro ao ler]"
        print(f"  [{i}] '{text}'")

    print("\n=== INPUTS / SELECTS / TEXTAREAS ===")
    inputs = page.locator("input, textarea, select").all()
    print(f"Encontrados {len(inputs)} campos:")
    for el in inputs:
        name = el.get_attribute("name") or el.get_attribute("id") or "[sem-nome]"
        itype = el.get_attribute("type") or el.evaluate("e => e.tagName.toLowerCase()")
        placeholder = el.get_attribute("placeholder") or ""
        print(f"  - {name} ({itype}) placeholder='{placeholder}'")

    print("\n=== EVENTOS DO FULLCALENDAR ===")
    # FullCalendar v6 renderiza eventos com a classe .fc-event
    events = page.locator(".fc-event").all()
    print(f"Encontrados {len(events)} eventos no calendário:")
    for i, ev in enumerate(events[:20]):  # primeiros 20
        try:
            text = ev.inner_text().strip().replace("\n", " | ")
        except Exception:
            text = "[erro ao ler]"
        print(f"  [{i}] '{text}'")

    print("\n=== BOTÕES DE VIEW DO CALENDÁRIO (mês/semana/dia) ===")
    # FullCalendar toolbar usa .fc-button
    fc_buttons = page.locator(".fc-button").all()
    print(f"Encontrados {len(fc_buttons)} botões do FullCalendar:")
    for i, b in enumerate(fc_buttons):
        try:
            text = b.inner_text().strip() if b.is_visible() else "[hidden]"
            title = b.get_attribute("title") or ""
        except Exception:
            text, title = "[erro]", ""
        print(f"  [{i}] '{text}' (title='{title}')")

    # Screenshot pra referência visual
    page.screenshot(path=SCREENSHOT_PATH, full_page=True)
    print(f"\nScreenshot salvo em: {SCREENSHOT_PATH}")

    browser.close()
    print("\nReconhecimento concluído.")
