import{u as S,j as e}from"./index-BUE6YFG3.js";import{e as z,u as E,d as o}from"./react-vendor-BdBPzOCq.js";import{e as q,w as C}from"./lucide-euIJhqGl.js";import"./zustand-Dz1QTqTt.js";const A="/assets/login-lab-BuZbgNbk.jpg",T="https://salas-senaiapi-production.up.railway.app",D="1.0.0";function F(){var u,m;const f=z(),x=E(),h=S(r=>r.setAuth),[b,g]=o.useState("credentials"),[t,v]=o.useState(""),[l,w]=o.useState(""),[s,d]=o.useState(!1),[p,i]=o.useState(null),y=((m=(u=x.state)==null?void 0:u.from)==null?void 0:m.pathname)??"/",j=o.useCallback(r=>{i(null),g(r)},[]);async function N(r){r.preventDefault(),d(!0),i(null);try{const a=await fetch(`${T}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:t,password:l})});if(!a.ok){i("E-mail ou senha inválidos.");return}const n=await a.json();h({user:n.user,accessToken:n.accessToken,refreshToken:n.refreshToken}),f(y,{replace:!0})}catch{i("Falha de conexão. Verifique sua rede e tente novamente.")}finally{d(!1)}}function c(){const r=t!==""&&l!==""&&!s;return e.jsxs("form",{onSubmit:a=>{N(a)},className:"lp-form",noValidate:!0,children:[e.jsxs("div",{className:"lp-field",children:[e.jsx("label",{htmlFor:"lp-email",className:"lp-label",children:"E-mail institucional"}),e.jsx("input",{id:"lp-email",type:"email",value:t,onChange:a=>v(a.target.value),placeholder:"Digite seu e-mail institucional",required:!0,autoComplete:"username",className:"lp-input",disabled:s})]}),e.jsxs("div",{className:"lp-field",children:[e.jsxs("div",{className:"lp-field-row",children:[e.jsx("label",{htmlFor:"lp-password",className:"lp-label",children:"Senha"}),e.jsx("button",{type:"button",className:"lp-forgot",disabled:!0,onClick:()=>j("forgot-password"),title:"Entre em contato com o administrador do sistema",children:"Esqueceu sua senha?"})]}),e.jsx("input",{id:"lp-password",type:"password",value:l,onChange:a=>w(a.target.value),placeholder:"••••••••",required:!0,autoComplete:"current-password",className:"lp-input",disabled:s})]}),p!==null&&e.jsx("p",{className:"lp-error",role:"alert",children:p}),e.jsx("button",{type:"submit",disabled:!r,className:"lp-btn",children:s?e.jsxs(e.Fragment,{children:[e.jsx(C,{size:17,className:"lp-spinner","aria-hidden":"true"}),"Entrando…"]}):"Entrar"})]})}function k(){switch(b){case"credentials":return c();default:return c()}}return e.jsxs("div",{className:"lp-wrapper",children:[e.jsxs("div",{className:"lp-shell",children:[e.jsxs("aside",{className:"lp-visual","aria-hidden":"true",children:[e.jsx("img",{src:A,alt:"",className:"lp-visual-img"}),e.jsx("div",{className:"lp-visual-overlay"}),e.jsxs("div",{className:"lp-visual-text",children:[e.jsx("span",{className:"lp-visual-brand",children:"SENAI"}),e.jsx("span",{className:"lp-visual-accent"}),e.jsx("span",{className:"lp-visual-sub",children:"Controle de Salas"})]})]}),e.jsxs("main",{className:"lp-form-col",children:[e.jsxs("div",{className:"lp-card",children:[e.jsxs("header",{className:"lp-header",children:[e.jsx("div",{className:"lp-logo","aria-hidden":"true",children:e.jsx(q,{size:26,strokeWidth:1.5})}),e.jsx("h1",{className:"lp-title",children:"SENAI Salas"}),e.jsx("p",{className:"lp-subtitle",children:"Sistema de Controle de Salas"})]}),k()]}),e.jsxs("footer",{className:"lp-footer",children:["SENAI Amazonas · v",D]})]})]}),e.jsx("style",{children:`
        .lp-wrapper {
          min-height: 100vh;
        }
        .lp-shell {
          display: flex;
          min-height: 100vh;
        }
        /* Painel visual — full-bleed, theme-invariant (mesma lógica já
           documentada da sidebar: superfície escura por natureza, sem
           contraparte dark). Sem --glass-sheen aqui: é fundo full-bleed
           sem borda/canto, não um card elevado — ver comentário no topo
           do arquivo. */
        .lp-visual {
          position: relative;
          flex: 0 0 54%;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .lp-visual-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Overlay navy da marca (rgba derivado de --color-brand/-brand-2,
           mesma técnica já usada em --sidebar-bg) + blur --glass-blur-s
           (The Two-Blur Rule) no "espírito liquid glass" pedido na missão —
           mais escuro embaixo, onde o texto fica, mais claro em cima.
           Alpha alto (0.78+) em toda a extensão porque a foto original é
           uma sala muito clara/branca — um wash mais leve (~0.5) deixava a
           imagem esbranquiçada em vez de escurecida, testado visualmente. */
        .lp-visual-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(200deg, rgba(24, 45, 74, 0.8) 0%, rgba(16, 32, 54, 0.82) 45%, rgba(8, 16, 28, 0.95) 100%);
          backdrop-filter: blur(var(--glass-blur-s));
          -webkit-backdrop-filter: blur(var(--glass-blur-s));
        }
        .lp-visual-text {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 56px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .lp-visual-brand {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 64px;
          font-weight: 700;
          letter-spacing: -1.5px;
          line-height: 1;
          color: #fff;
        }
        /* Barra de 3px em --color-accent — realocada do card (ver topo do
           arquivo); "The Rare Ember Rule" lista barra de 3px como uso
           permitido, mesmo dispositivo do indicador ativo da sidebar. */
        .lp-visual-accent {
          width: 32px;
          height: 3px;
          border-radius: 3px;
          background: var(--color-accent);
        }
        .lp-visual-sub {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
        }
        .lp-form-col {
          flex: 1 1 46%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          gap: 16px;
        }
        .lp-card {
          position: relative;
          width: 100%;
          max-width: 540px;
          background: var(--color-surface);
          backdrop-filter: blur(var(--glass-blur-s)) saturate(140%);
          -webkit-backdrop-filter: blur(var(--glass-blur-s)) saturate(140%);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-s), var(--glass-sheen);
          padding: 48px 44px 44px;
        }
        /* Visualmente oculto em desktop (marca já aparece no painel visual,
           ver topo do arquivo) mas sempre presente no DOM — heading real
           acessível por leitor de tela nas duas larguras. Reaparece
           visualmente em mobile (ver media query abaixo). */
        .lp-header {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .lp-logo {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .lp-title {
          margin: 0 0 6px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.4px;
          color: var(--color-text);
        }
        .lp-subtitle {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lp-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        /* Rótulo, input e botão maiores que a receita padrão de
           input-search/button-secondary do DESIGN.md (34px/12px) —
           exceção pontual pedida pro card de login, que agora tem uma
           coluna dedicada (~46%) e espaço de sobra; não muda o token
           documentado pros inputs do resto do sistema (tabelas, filtros
           etc.), só este card. */
        .lp-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-muted);
        }
        .lp-forgot {
          font-size: 13px;
          color: var(--color-muted);
          background: none;
          border: none;
          padding: 0;
          cursor: default;
          opacity: 0.5;
          font-family: inherit;
        }
        .lp-input {
          height: 48px;
          padding: 0 16px;
          border-radius: var(--radius-s);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text);
          font-family: inherit;
          font-size: 15px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color var(--dur) var(--ease);
        }
        .lp-input:focus {
          border-color: var(--color-brand);
        }
        .lp-input:disabled { opacity: 0.6; }
        .lp-input::placeholder { color: var(--color-subtle); opacity: 1; }
        .lp-error {
          margin: 0;
          padding: 12px 14px;
          border-radius: var(--radius-s);
          background: var(--color-red-l);
          color: var(--color-red);
          font-size: 14px;
          font-weight: 500;
        }
        .lp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 50px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          border: none;
          font-family: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--dur) var(--ease);
          margin-top: 6px;
          width: 100%;
        }
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lp-btn:not(:disabled):hover { background: var(--color-brand-2); }
        .lp-spinner {
          animation: lp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .lp-footer {
          font-size: 11px;
          color: var(--color-muted);
          text-align: center;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* Mesmo breakpoint do resto do app (768px, ver global.css) — painel
           visual desaparece por completo (decisão de design, ver comentário
           no topo do arquivo) e o heading do card volta a ficar visível. */
        @media (max-width: 768px) {
          .lp-visual {
            display: none;
          }
          .lp-form-col {
            flex: 1 1 100%;
            padding: 16px;
          }
          .lp-header {
            position: static;
            width: auto;
            height: auto;
            margin: 0 0 24px;
            padding: 0;
            overflow: visible;
            clip: auto;
            white-space: normal;
            text-align: center;
          }
        }
      `})]})}export{F as default};
//# sourceMappingURL=index-Ch8O9Lcx.js.map
