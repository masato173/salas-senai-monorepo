import{j as e}from"./index-BBHqOy1b.js";import{e as w,d as a,L as N}from"./react-vendor-BdBPzOCq.js";import{l as y}from"./login-lab-DrZH7Poh.js";import{e as k,o as S,w as z}from"./lucide-euIJhqGl.js";import"./zustand-Dz1QTqTt.js";const C="https://salas-senaiapi-production.up.railway.app",E="1.0.0";function q(){const d=w(),[i,u]=a.useState(""),[o,m]=a.useState(""),[l,x]=a.useState(""),[s,p]=a.useState(!1),[c,t]=a.useState(null),[f,h]=a.useState(!1);async function g(r){r.preventDefault(),p(!0),t(null);try{const n=await fetch(`${C}/auth/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:i,email:o,password:l})});if(!n.ok){n.status===409?t("Este email já está cadastrado."):n.status===400?t("Use um e-mail institucional válido."):t("Não foi possível criar a conta. Tente novamente.");return}h(!0),setTimeout(()=>d("/login",{replace:!0}),1800)}catch{t("Falha de conexão. Verifique sua rede e tente novamente.")}finally{p(!1)}}const v=i!==""&&o!==""&&l.length>=6&&!s;function b(){return e.jsxs("div",{className:"rp-success",role:"status",children:[e.jsx(S,{size:40,className:"rp-success-icon","aria-hidden":"true"}),e.jsx("p",{className:"rp-success-title",children:"Conta criada com sucesso"}),e.jsx("p",{className:"rp-success-sub",children:"Redirecionando para o login…"})]})}function j(){return e.jsxs("form",{onSubmit:r=>void g(r),className:"rp-form",noValidate:!0,children:[e.jsxs("div",{className:"rp-field",children:[e.jsx("label",{htmlFor:"rp-name",className:"rp-label",children:"Nome completo"}),e.jsx("input",{id:"rp-name",type:"text",value:i,onChange:r=>u(r.target.value),placeholder:"Digite seu nome completo",required:!0,autoComplete:"name",className:"rp-input",disabled:s})]}),e.jsxs("div",{className:"rp-field",children:[e.jsx("label",{htmlFor:"rp-email",className:"rp-label",children:"E-mail institucional"}),e.jsx("input",{id:"rp-email",type:"email",value:o,onChange:r=>m(r.target.value),placeholder:"Digite seu e-mail institucional",required:!0,autoComplete:"username",className:"rp-input",disabled:s})]}),e.jsxs("div",{className:"rp-field",children:[e.jsx("label",{htmlFor:"rp-password",className:"rp-label",children:"Senha"}),e.jsx("input",{id:"rp-password",type:"password",value:l,onChange:r=>x(r.target.value),placeholder:"••••••••",required:!0,autoComplete:"new-password",className:"rp-input",disabled:s}),e.jsx("span",{className:"rp-hint",children:"Mínimo de 6 caracteres"})]}),c!==null&&e.jsx("p",{className:"rp-error",role:"alert",children:c}),e.jsx("button",{type:"submit",disabled:!v,className:"rp-btn",children:s?e.jsxs(e.Fragment,{children:[e.jsx(z,{size:17,className:"rp-spinner","aria-hidden":"true"}),"Criando conta…"]}):"Criar conta"}),e.jsxs("p",{className:"rp-footer-link",children:["Já tem conta? ",e.jsx(N,{to:"/login",children:"Entrar"})]})]})}return e.jsxs("div",{className:"rp-wrapper",children:[e.jsxs("div",{className:"rp-shell",children:[e.jsxs("aside",{className:"rp-visual","aria-hidden":"true",children:[e.jsx("img",{src:y,alt:"",className:"rp-visual-img"}),e.jsx("div",{className:"rp-visual-overlay"}),e.jsxs("div",{className:"rp-visual-text",children:[e.jsx("span",{className:"rp-visual-brand",children:"SENAI"}),e.jsx("span",{className:"rp-visual-accent"}),e.jsx("span",{className:"rp-visual-sub",children:"Controle de Salas"})]})]}),e.jsxs("main",{className:"rp-form-col",children:[e.jsxs("div",{className:"rp-card",children:[e.jsxs("header",{className:"rp-header",children:[e.jsx("div",{className:"rp-logo","aria-hidden":"true",children:e.jsx(k,{size:26,strokeWidth:1.5})}),e.jsx("h1",{className:"rp-title",children:"Criar conta"}),e.jsx("p",{className:"rp-subtitle",children:"Sistema de Controle de Salas"})]}),f?b():j()]}),e.jsxs("footer",{className:"rp-footer",children:["SENAI Amazonas · v",E]})]})]}),e.jsx("style",{children:`
        .rp-wrapper {
          min-height: 100vh;
        }
        .rp-shell {
          display: flex;
          min-height: 100vh;
        }
        .rp-visual {
          position: relative;
          flex: 0 0 54%;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .rp-visual-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rp-visual-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(200deg, rgba(24, 45, 74, 0.8) 0%, rgba(16, 32, 54, 0.82) 45%, rgba(8, 16, 28, 0.95) 100%);
          backdrop-filter: blur(var(--glass-blur-s));
          -webkit-backdrop-filter: blur(var(--glass-blur-s));
        }
        .rp-visual-text {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 56px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .rp-visual-brand {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 64px;
          font-weight: 700;
          letter-spacing: -1.5px;
          line-height: 1;
          color: #fff;
        }
        .rp-visual-accent {
          width: 32px;
          height: 3px;
          border-radius: 3px;
          background: var(--color-accent);
        }
        .rp-visual-sub {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
        }
        .rp-form-col {
          flex: 1 1 46%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          gap: 16px;
        }
        .rp-card {
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
        .rp-header {
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
        .rp-logo {
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
        .rp-title {
          margin: 0 0 6px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.4px;
          color: var(--color-text);
        }
        .rp-subtitle {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .rp-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .rp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rp-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-muted);
        }
        .rp-hint {
          font-size: 11px;
          color: var(--color-subtle);
        }
        .rp-input {
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
        .rp-input:focus {
          border-color: var(--color-brand);
        }
        .rp-input:disabled { opacity: 0.6; }
        .rp-input::placeholder { color: var(--color-subtle); opacity: 1; }
        .rp-error {
          margin: 0;
          padding: 12px 14px;
          border-radius: var(--radius-s);
          background: var(--color-red-l);
          color: var(--color-red);
          font-size: 14px;
          font-weight: 500;
        }
        .rp-btn {
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
        .rp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .rp-btn:not(:disabled):hover { background: var(--color-brand-2); }
        .rp-spinner {
          animation: rp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .rp-footer-link {
          margin: 0;
          text-align: center;
          font-size: 13px;
          color: var(--color-muted);
        }
        .rp-footer-link a {
          color: var(--color-blue);
          font-weight: 600;
          text-decoration: none;
        }
        .rp-footer-link a:hover {
          text-decoration: underline;
        }
        .rp-footer {
          font-size: 11px;
          color: var(--color-muted);
          text-align: center;
        }
        .rp-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          padding: 12px 0 4px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .rp-success-icon {
          color: var(--color-green);
          margin-bottom: 8px;
        }
        .rp-success-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text);
        }
        .rp-success-sub {
          margin: 0;
          font-size: 13px;
          color: var(--color-muted);
        }
        @keyframes rp-spin { to { transform: rotate(360deg); } }
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .rp-visual {
            display: none;
          }
          .rp-form-col {
            flex: 1 1 100%;
            padding: 16px;
          }
          .rp-header {
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
      `})]})}export{q as default};
//# sourceMappingURL=index-CLgSMRH-.js.map
