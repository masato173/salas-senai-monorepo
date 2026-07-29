import{u as k,j as e}from"./index-D-FetLy-.js";import{e as E,u as z,d as t}from"./react-vendor-BdBPzOCq.js";import{e as C,v as A}from"./lucide-Bvxn_TEf.js";import"./zustand-Dz1QTqTt.js";const T="https://salas-senaiapi-production.up.railway.app",P="1.0.0";function O(){var u,m;const f=E(),x=z(),h=k(a=>a.setAuth),[g,b]=t.useState("credentials"),[l,v]=t.useState(""),[i,y]=t.useState(""),[o,d]=t.useState(!1),[c,s]=t.useState(null),j=((m=(u=x.state)==null?void 0:u.from)==null?void 0:m.pathname)??"/",w=t.useCallback(a=>{s(null),b(a)},[]);async function N(a){a.preventDefault(),d(!0),s(null);try{const r=await fetch(`${T}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:l,password:i})});if(!r.ok){s("E-mail ou senha inválidos.");return}const n=await r.json();h({user:n.user,accessToken:n.accessToken,refreshToken:n.refreshToken}),f(j,{replace:!0})}catch{s("Falha de conexão. Verifique sua rede e tente novamente.")}finally{d(!1)}}function p(){const a=l!==""&&i!==""&&!o;return e.jsxs("form",{onSubmit:r=>{N(r)},className:"lp-form",noValidate:!0,children:[e.jsxs("div",{className:"lp-field",children:[e.jsx("label",{htmlFor:"lp-email",className:"lp-label",children:"E-mail institucional"}),e.jsx("input",{id:"lp-email",type:"email",value:l,onChange:r=>v(r.target.value),placeholder:"Digite seu e-mail institucional",required:!0,autoComplete:"username",className:"lp-input",disabled:o})]}),e.jsxs("div",{className:"lp-field",children:[e.jsxs("div",{className:"lp-field-row",children:[e.jsx("label",{htmlFor:"lp-password",className:"lp-label",children:"Senha"}),e.jsx("button",{type:"button",className:"lp-forgot",disabled:!0,onClick:()=>w("forgot-password"),title:"Entre em contato com o administrador do sistema",children:"Esqueceu sua senha?"})]}),e.jsx("input",{id:"lp-password",type:"password",value:i,onChange:r=>y(r.target.value),placeholder:"••••••••",required:!0,autoComplete:"current-password",className:"lp-input",disabled:o})]}),c!==null&&e.jsx("p",{className:"lp-error",role:"alert",children:c}),e.jsx("button",{type:"submit",disabled:!a,className:"lp-btn",children:o?e.jsxs(e.Fragment,{children:[e.jsx(A,{size:15,className:"lp-spinner","aria-hidden":"true"}),"Entrando…"]}):"Entrar"})]})}function S(){switch(g){case"credentials":return p();default:return p()}}return e.jsxs("div",{className:"lp-wrapper",children:[e.jsxs("main",{className:"lp-card",children:[e.jsxs("header",{className:"lp-header",children:[e.jsx("div",{className:"lp-logo","aria-hidden":"true",children:e.jsx(C,{size:26,strokeWidth:1.5})}),e.jsx("h1",{className:"lp-title",children:"SENAI Salas"}),e.jsx("p",{className:"lp-subtitle",children:"Sistema de Controle de Salas"})]}),S()]}),e.jsxs("footer",{className:"lp-footer",children:["SENAI Amazonas · v",P]}),e.jsx("style",{children:`
        .lp-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          padding: 16px;
          gap: 14px;
        }
        .lp-card {
          width: 100%;
          max-width: 400px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 40px 32px 36px;
        }
        .lp-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .lp-logo {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: var(--color-brand);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .lp-title {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text);
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: -0.01em;
        }
        .lp-subtitle {
          margin: 0;
          font-size: 11px;
          color: var(--color-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .lp-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }
        .lp-forgot {
          font-size: 12px;
          color: var(--color-muted);
          background: none;
          border: none;
          padding: 0;
          cursor: default;
          opacity: 0.5;
          font-family: inherit;
        }
        .lp-input {
          padding: 9px 11px;
          border-radius: var(--radius-s);
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .lp-input:focus {
          border-color: var(--color-brand);
        }
        .lp-input:disabled { opacity: 0.6; }
        .lp-input::placeholder { color: var(--color-muted); opacity: 1; }
        .lp-error {
          margin: 0;
          padding: 9px 11px;
          border-radius: var(--radius-s);
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          font-size: 13px;
        }
        .lp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 38px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          margin-top: 4px;
          width: 100%;
          font-family: inherit;
        }
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lp-btn:not(:disabled):hover { opacity: 0.9; }
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
      `})]})}export{O as default};
//# sourceMappingURL=index-DgdCxqxU.js.map
