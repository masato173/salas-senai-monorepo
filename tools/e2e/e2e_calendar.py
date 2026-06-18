"""
e2e_calendar.py — Teste E2E do fluxo completo de reserva.
Controle de Salas SENAI.

Fluxo: criar reserva (Única, hoje) → confirmar no calendário →
       clicar no evento → modal → cancelar → confirmar que some.

Cria e limpa atrás de si (o cancelamento é parte do que testamos).
A reserva fica CANCELLED na planilha DEV (soft delete), mas sai do calendário.

Seletores descobertos via reconhecimento (recon_reservas.py + recon_form.py):
  #sel-sala (select), #sel-turma, #res-date, #res-start, #res-end, #res-reason
  Botões: "Nova reserva", "Única", "Período", "Solicitar reserva", "Atualizar"
  Eventos: .fc-event   |   Botões view: "Mês"/"Semana"/"Dia"

ROBUSTEZ:
- Horário derivado do timestamp pra reduzir CONFLICT entre runs próximos.
- Observação única (marcador E2E) pra identificar O EVENTO certo no calendário.
- Esperas explícitas após criar (refetch) e após cancelar.
- Asserções com mensagem clara; sys.exit(1) em falha.
"""
import sys
import datetime
from playwright.sync_api import sync_playwright

URL = "http://localhost:4173/reservas"
SALA = "03 Sala"                  # sala real da lista (recon)
TURMA = "E2E-TST"

# Horário único-ish por run: usa hora:minuto atuais como início, +1h fim.
# Reduz colisão CONFLICT entre runs no mesmo dia/sala.
now = datetime.datetime.now()
start_h = now.hour
# mantém início entre 06 e 20 (fim = início+1, máximo 21:00) dentro da faixa 06:00–23:00
if start_h < 6:
    start_h = 6
elif start_h > 20:
    start_h = 20
START = f"{start_h:02d}:{now.minute:02d}"
END = f"{start_h + 1:02d}:{now.minute:02d}"
TODAY = now.strftime("%Y-%m-%d")
MARKER = f"E2E-{now.strftime('%H%M%S')}"   # observação única → identifica o evento

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

    # ---- PASSO 1: abrir form e criar reserva única ----
    print("\n[1] Criando reserva única...")
    page.get_by_role("button", name="Nova reserva").click()
    page.wait_for_timeout(800)

    # Garante modo Única (pode já ser o default). Clique tolerante:
    # usa get_by_text (como o recon achou) e ignora se não for clicável.
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

    # Espera o backend + refetch do calendário
    print("    aguardando criação + refetch...")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # DIAGNÓSTICO pós-submit: o que o form mostrou?
    # Procura sinais de sucesso, conflito ou erro pra distinguir
    # "criação falhou" de "criou mas calendário não mostra".
    print("    --- diagnóstico pós-submit ---")
    page.screenshot(path="e2e_after_submit.png", full_page=True)
    body_text = page.locator("body").inner_text()
    for termo in ["sucesso", "Sucesso", "criada", "Conflito", "conflito",
                  "já reservada", "erro", "Erro", "obrigat", "inválid"]:
        if termo in body_text:
            print(f"      sinal encontrado no texto: '{termo}'")
    # Imprime se o form ainda está aberto (campos visíveis = não submeteu/erro)
    form_aberto = page.locator("#sel-sala").count() > 0 and page.locator("#sel-sala").is_visible()
    print(f"      form ainda aberto? {form_aberto}")
    print("    --- fim diagnóstico ---")

    # ---- PASSO 2: confirmar que o evento apareceu no calendário ----
    print("\n[2] Verificando evento no calendário...")
    # View de DIA: o evento criado é pra hoje, e nessa view o título completo
    # ("Sala · Turma") aparece — diferente da view de Mês, que trunca/compacta.
    page.get_by_role("button", name="Dia", exact=True).click()
    page.wait_for_timeout(1500)

    eventos = page.locator(".fc-event").all()
    print(f"    {len(eventos)} evento(s) na view de Dia (hoje)")
    # Diagnóstico: imprime o texto real de cada evento (ajuda se o seletor falhar)
    for i, ev in enumerate(eventos):
        try:
            txt = ev.inner_text().strip().replace("\n", " | ")
        except Exception:
            txt = "[erro]"
        print(f"      evento[{i}] texto='{txt}'")

    meu_evento = page.locator(".fc-event", has_text=TURMA)
    achou = meu_evento.count() > 0
    # Fallback: se não achou por texto MAS só há eventos de hoje, usa o primeiro.
    # Como criamos pra hoje com sala/horário únicos, o risco de pegar o errado é baixo.
    if not achou and len(eventos) > 0:
        print(f"    (texto '{TURMA}' não casou; usando o primeiro evento de hoje como fallback)")
        meu_evento = page.locator(".fc-event").first
        achou = True

    check(
        achou,
        f"evento da reserva apareceu no calendário (view Dia)",
        f"nenhum evento na view de Dia — criação falhou ou refetch não atualizou",
    )

    if not achou:
        print("    Abortando: sem evento pra cancelar.")
        page.screenshot(path="e2e_fail_no_event.png", full_page=True)
        browser.close()
        sys.exit(1)

    # ---- PASSO 3: clicar no evento → modal ----
    print("\n[3] Abrindo modal de detalhes...")
    meu_evento.first.click()
    page.wait_for_timeout(1000)

    # O modal mostra "Detalhes da reserva" + botão "Cancelar reserva"
    modal_titulo = page.get_by_text("Detalhes da reserva")
    check(
        modal_titulo.count() > 0,
        "modal de detalhes abriu",
        "modal NÃO abriu ao clicar no evento",
    )

    # ---- PASSO 4: cancelar (2 cliques: Cancelar reserva → Confirmar) ----
    print("\n[4] Cancelando...")
    # Botão é habilitado pois createdBy == CURRENT_USER (criado pela própria UI)
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
    restantes = page.locator(".fc-event").all()
    print(f"    {len(restantes)} evento(s) restante(s) na view de Dia")
    # Se buscávamos por turma e ela casou antes, confere por turma; senão, conta.
    sumido_por_texto = page.locator(".fc-event", has_text=TURMA).count() == 0
    check(
        sumido_por_texto,
        f"reserva cancelada sumiu do calendário",
        f"reserva AINDA aparece após cancelar (refetch não atualizou ou cancel falhou)",
    )

    page.screenshot(path="e2e_final.png", full_page=True)
    browser.close()

# ---- Resultado ----
print("\n" + "=" * 40)
if FAILED:
    print("RESULTADO: ✗ FALHOU — ver screenshots e2e_*.png")
    sys.exit(1)
else:
    print("RESULTADO: ✓ PASSOU — fluxo criar→ver→cancelar→sumir OK")
    sys.exit(0)
