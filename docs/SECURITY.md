# Security - what is implemented and what else is available

## Implemented: engine-validated basic authentication

* The login page collects user name and password; `AuthService.signIn` sends `GET /user/current` with an `Authorization: Basic`
  header. The engine's security registry (WebSphere federated repositories: file registry, LDAP, ...) decides. No account data
  lives in the portal.
* The credentials are kept in **session storage of the browser tab** (gone when the tab closes, never in local storage) and the
  `authInterceptor` adds the header to every engine call. A 401 on any later call returns the user to the login page
  (`errorInterceptor`).
* **Authorisation is the engine's**: the task list is filtered by `filterByCurrentUser`, task and instance actions come from
  `GET /task/actions` / `GET /process/{id}/actions`, launchable processes from `GET /exposed/process` (exposed teams),
  teams and memberships from the registry. The portal shows what the engine answers and displays the engine's refusals
  (e.g. CWTBG0570E) verbatim.
* Same-origin deployment (dev proxy / nginx location) keeps the browser away from CORS and keeps the credentials off third-party
  origins. TLS terminates at nginx; the proxy to the engine uses HTTPS.
* The demo build has no credentials: the stub accepts the fixture users with the password `demo`, shown on the login page.

## Available alternatives (not implemented, all compatible with the code base)

| Option | How it works with the engine | What changes in the portal |
|---|---|---|
| **LTPA single sign-on (WebSphere / Liberty)** | The user authenticates once (form login at `/ProcessCenter/login.jsp` or any application in the SSO domain); the `LtpaToken2` cookie is sent automatically to the engine on the same DNS domain. | Drop the basic header; the portal must be served under the SSO domain (cookie scope); `GET /user/current` establishes the session; logout = `/ProcessCenter/logout` or cookie expiry. |
| **CSRF token session (`POST /bpm/system/login`)** | Exchanges basic credentials once for a `csrf_token` plus session cookies; the v2 (`/bpm`) and Operations (`/ops`) families require the `BPMCSRFToken` header on every call. | Needed when the adapter moves to the v2 family; the token lives in memory, the password can be discarded after login. |
| **OpenID Connect (WAS OIDC TAI / Liberty openidConnectClient, CP4BA Zen + IAM)** | The engine trusts an identity provider (Azure AD, Keycloak, IBM Verify); on CP4BA every call carries a Zen bearer token (`Authorization: Bearer` from `/v1/preauth/validateAuth` + `/idprovider/v1/auth/identitytoken`). | Replace `AuthService` with an OIDC client (PKCE code flow, e.g. angular-oauth2-oidc); the interceptor sends the bearer token; refresh handled by the library. |
| **SAML 2.0 (WAS SAML TAI)** | Browser-side SAML assertion exchanged for an LTPA cookie by the engine. | Same as LTPA SSO from the portal's point of view. |
| **Kerberos / SPNEGO** | Desktop credentials negotiated by the browser with the engine (WAS SPNEGO TAI). | No login page; `GET /user/current` succeeds transparently on domain machines. |
| **API gateway / reverse proxy authentication** | nginx, IBM DataPower or API Connect authenticate the user (client certificates, OAuth) and inject the engine credentials or an LTPA token server side. | The portal sends nothing; the gateway owns the credentials; ideal when the engine must never be reachable directly. |
| **Client certificates (mutual TLS)** | WAS client certificate authentication mapped to registry users. | Browser presents the certificate; no login page. |
| **Technical user with impersonation (`?runAs=` / `on behalf of`)** | Not offered by the classic API for end-user actions; only the Operations REST family supports administrative impersonation on CP4BA. | Not applicable for a user portal. |

## CP4BA specifics

On Cloud Pak for Business Automation the Workflow route sits behind Zen / IAM. The options that apply there (details and the
validation plan in docs/CP4BA.md): Zen identity token (`/v1/preauth/validateAuth` + `/idprovider/v1/auth/identitytoken`, header
`Authorization: Bearer`), Zen SSO cookie (`ibm-private-cloud-session`, browser login on the same domain), **Zen API key** for technical
callers (`Authorization: ZenApiKey base64(user:key)`), the enterprise IdP configured in IAM (OIDC / SAML / LDAP). Every `/bpm` and `/ops`
call additionally carries `BPMCSRFToken` from `POST /bpm/system/login`. Authorisation stays role based on the engine (administrator
role for Operations REST, team membership for task actions, `ACTION_VIEW_USERS` / `ACTION_VIEW_GROUPS` for directory listings).

## Hardening checklist for a production deployment

* Serve only over HTTPS; set `Strict-Transport-Security`, `Content-Security-Policy` (self + fonts.googleapis.com / fonts.gstatic.com
  for the Material fonts, or self-host them), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
* Restrict the reverse proxy to the resources the portal uses (`/rest/bpm/wle/v1/**`); do not expose `/ProcessAdmin`,
  `/WebPD`, `/bpm/system/*` through the portal host.
* Short session lifetime on the engine side (WAS `LTPA timeout`, `com.ibm.ws.security.web.inactivityTimeout`) when SSO is used.
* Audit: the engine logs every action with the user; the portal adds nothing that bypasses it.
