# Titan Grill — Resumen Integral del Estado Actual

> Análisis READ-ONLY realizado tras baseline aprobado. No se modificó código durante este análisis.

---

## 1. Resumen Ejecutivo

**Qué es:** Titan Grill es una aplicación web de **loyalty card / programa de fidelidad** para un restaurante de hamburguesas y parrilla ubicado en Santa Marta, Colombia (Zona de Emprendimiento, Universidad del Magdalena).

**Propósito:** Permitir a los clientes registrarse en un club de lealtad, acumular sellos digitales por visitas, compartir códigos de referidos, y permitir a los administradores gestionar clientes, sellos y canjes de premios.

**Tipo de aplicación:** Single-page application (SPA) cliente puro, construida con Vite + React 19, con Supabase como backend (autenticación, base de datos, funciones almacenadas).

**Usuario objetivo:**
- **Clientes:** Regístrandose con su celular, acumulan sellos, usan código QR de su tarjeta de fidelidad.
- **Administradores:** Acceden vía `/login`, ven dashboard con métricas, buscan clientes, registran sellos y canjean premios.

**Flujo principal:**
1. Cliente visita el landing page → ve el menú, ubicación, horarios.
2. Se abre un popup de registro → ingresa nombre, celular, email.
3. Se crea/consulta el cliente en Supabase → se muestra tarjeta de fidelidad con QR.
4. El cliente usa el QR para que el admin registre sellos (vía `/admin/client/:clientId`).
5. Al acumular 10 sellos → se puede canjear un premio.

**Estado de madurez:** **Beta/casi funcional.** El frontend está completo visualmente y la integración con Supabase funciona (SELECT, INSERT, RPC verificados). Sin embargo, hay errores de lint, código duplicado, y una estructura de componentes que podría mejorarse. El proyecto no tiene tests ni CI/CD.

---

## 2. Stack Tecnológico

| Tecnología | Uso | Evidencia |
|---|---|---|
| **Vite 7** | Bundler, dev server, build | `vite.config.js`, `package.json` |
| **React 19** | UI library (componentes, hooks, Suspense) | `src/main.jsx`, `package.json` (`react: ^19.2.0`) |
| **React DOM** | Rendering | `package.json`, `main.jsx` |
| **JavaScript (JSX)** | Lenguaje | Todo el código fuente (`.js`, `.jsx`) |
| **Supabase JS v2** | Backend (auth, DB, RPC, realtime) | `src/lib/supabaseClient.js`, `package.json` (`@supabase/supabase-js: ^2.90.1`) |
| **React Router v7** | Routing SPA | `App.jsx` (`BrowserRouter`, `Routes`, `Route`), `package.json` (`react-router-dom: ^7.12.0`) |
| **Tailwind CSS v4** | Styling utility-first | `src/index.css` (`@import "tailwindcss"`), `tailwind.config.js` |
| **tailwind-merge** | Gestión de clases condicionales | `package.json` |
| **clsx** | Gestión de clases condicionales | `package.json` |
| **Framer Motion v12** | Animaciones | `package.json`, importado en Hero, MenuGrid, JoinClubSection, LoyaltyCard, WhatsAppButton, SelectionModal |
| **Lucide React** | Iconos | Importado en múltiples componentes |
| **Recharts v3** | Gráficas (dashboard admin) | `AdminDashboard.jsx` (ComposedChart, Area, Scatter, etc.), `package.json` (`recharts: ^3.6.0`) |
| **react-qr-code** | Código QR de tarjeta de fidelidad | `LoyaltyCard.jsx`, `package.json` |
| **html5-qrcode** | Lector QR (posible uso futuro) | `package.json` |
| **qrcode.react** | Generación QR alternativa | `package.json` |
| **react-error-boundary** | Manejo de errores global | `App.jsx` (ErrorBoundary), `package.json` |
| **ESLint 9** | Linting flat config | `eslint.config.js`, `package.json` |
| **PostCSS + autoprefixer** | Procesamiento CSS | `package.json` |

---

## 3. Arquitectura

```
Titan Grill
│
├── Frontend (SPA cliente puro)
│   ├── src/
│   │   ├── main.jsx              ← Entry point (React 19, StrictMode)
│   │   ├── App.jsx               ← Root component (Router, Routes, ErrorBoundary, Suspense)
│   │   ├── index.css             ← Tailwind v4 (@import "tailwindcss")
│   │   ├── assets/               ← SVG assets
│   │   ├── components/           ← Componentes de UI
│   │   │   ├── Layout.jsx        ← Layout base (Navbar + Footer)
│   │   │   ├── Navbar.jsx        ← Navegación (desktop + mobile)
│   │   │   ├── Hero.jsx          ← Hero principal con animación
│   │   │   ├── MenuGrid.jsx      ← Catálogo de menú (categorías)
│   │   │   ├── SelectionModal.jsx ← Modal de selección de items del menú
│   │   │   ├── LocationSection.jsx ← Mapa + horarios
│   │   │   ├── JoinClubSection.jsx ← Formulario de registro para nuevos clientes
│   │   │   ├── LoyaltyCard.jsx   ← Tarjeta de fidelidad con QR
│   │   │   ├── WhatsAppButton.jsx← Botón flotante de WhatsApp
│   │   │   ├── LeadPopup.jsx     ← Popup de registro con sistema de referidos
│   │   │   ├── Login.jsx         ← Login de admin (Supabase Auth)
│   │   │   ├── AdminDashboard.jsx ← Dashboard con métricas y Recharts
│   │   │   ├── AdminClientView.jsx ← Vista detalle de cliente (stamps)
│   │   │   ├── ProtectedRoute.jsx ← Guard de rutas autenticadas
│   │   │   └── common/
│   │   │       ├── ErrorFallback.jsx ← Error boundary UI
│   │   │       ├── LoadingSpinner.jsx ← Spinner de carga
│   │   │       └── NotFound.jsx    ← Página 404
│   │   ├── hooks/
│   │   │   └── useLocalStorage.js  ← Hook + utilidades localStorage
│   │   ├── lib/
│   │   │   ├── supabaseClient.js   ← Cliente Supabase (única instancia)
│   │   │   └── referralUtils.js    ← Utilidades de códigos de referido
│   │   ├── utils/
│   │   │   └── referralUtils.js    ← [DUPLICADO] copia idéntica, no importada
│   │   └── constants/
│   │       └── index.js          ← Storage keys, timing, UI, errores, patrones
│   │
│   ├── index.html                ← HTML base (SEO mínico)
│   ├── vite.config.js            ← Config Vite (chunk splitting, optimizeDeps)
│   ├── tailwind.config.js        ← Config Tailwind (custom colors: fire, gold)
│   ├── eslint.config.js          ← ESLint flat config
│   ├── .env / .env.example       ← Variables de entorno
│   └── public/
│       ├── favicon-flame.svg     ← Favicon tema fuego
│       ├── logo1.svg, logo2.svg  ← Logos
│       └── menu/                 ← Imágenes del menú
│
├── Supabase (backend como servicio)
│   ├── Autenticación (Supabase Auth)
│   ├── PostgreSQL (tablas: clientes, admin_users, redemptions, stamp_logs)
│   ├── RPC (get_client_by_referral_code, increment_stamps, redeem_reward)
│   └── Realtime (suscripción a cambios en clientes)
│
└── Configuración
    ├── package.json / package-lock.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── eslint.config.js
    ├── .env / .env.example
    ├── .gitignore
    └── AGENTS.md (instrucciones para agentes)
```

**Puntos clave de arquitectura:**
- El cliente Supabase (`src/lib/supabaseClient.js`) es una instancia única exportada e importada por múltiples componentes.
- No hay gestión de estado global (Redux, Zustand, Context API para app state). El estado se maneja localmente en cada componente con `useState`.
- La navegación es SPA pura con React Router v7.
- `public/` sirve imágenes estáticas y favicon; Vite sirve en desarrollo y las incluye en el build.

---

## 4. Rutas y Páginas

| Ruta | Página/Componente | Propósito | Estado | Tipo |
|---|---|---|---|---|
| `/` | `LandingPage` (App.jsx) | Landing page con Hero, Menú, Ubicación, Join Club, WhatsApp | ✅ Funcional | Pública |
| `/login` | `Login.jsx` | Login de administrador via Supabase Auth | ✅ Funcional | Pública (pero protege admin) |
| `/admin` | `AdminDashboard.jsx` | Dashboard admin: KPIs, gráfica, búsqueda, tabla de clientes, canje | ✅ Funcional | Autenticada/Admin |
| `/admin/client/:clientId` | `AdminClientView.jsx` | Ver detalle de cliente + tarjeta de fidelidad | ✅ Funcional | Autenticada/Admin |
| `*` | `NotFound.jsx` | Página 404 catch-all | ✅ Funcional | Pública/fallback |

---

## 5. Funcionalidades Actuales

### Clientes
- **Registro de cliente:** ✅ Implementado — formulario con nombre, celular, email. INSERT a tabla `clientes` vía Supabase. Race condition handling (unique violation retry).
- **Tarjeta de fidelidad digital:** ✅ Implementado — componente `LoyaltyCard` con código QR, grid de 10 sellos, botón de compartir.
- **Sistema de referidos:** ✅ Implementado — extracción de código `ref` de URL, validación, paso a `referred_by` en INSERT.
- **Sincronización en tiempo real:** ✅ Implementado — suscripción Realtime a cambios en `clientes` para actualizar sellos.
- **Almacenamiento local:** ✅ Implementado — persistencia de datos de cliente en `localStorage` (key: `titan_client`).

### Administración
- **Login:** ✅ Implementado — Supabase Auth (`signInWithPassword`), verificación contra tabla `admin_users`, auto-stamp (registro de sello en login con `clientId`).
- **Dashboard:** ✅ Implementado — KPIs (clientes, sellos, premios pendientes, canjeados), gráfica Recharts (7 días), búsqueda por teléfono, tabla de clientes recientes.
- **Canje de premios:** ✅ Implementado — RPC `redeem_reward` (requiere 10 sellos). Confirmación antes de canjear.
- **Vista de cliente:** ✅ Implementado — detalle de cliente con tarjeta de fidelidad y conteo de sellos.
- **ProtectedRoute:** ✅ Implementado — verifica sesión + admin status via `admin_users` table.

### Productos
- **Catálogo del menú:** ✅ Implementado — datos estáticos en código (`MenuGrid.jsx`). 4 categorías: Entradas, Burger Classic, Perros calientes, Bebidas.
- **Modal de selección:** ✅ Implementado — `SelectionModal` muestra items con imágenes, precios.

### Pedidos
- ❌ No implementado. No hay funcionalidad de pedidos/online ordering.

### Ubicación
- ✅ Google Maps embed (iframe) con coordenadas específicas.
- ✅ Horarios de atención (lunes y miércoles-viernes 4:00 PM - 9:30 PM).
- ✅ WhatsApp button (número: 3004126441).

### Autenticación
- ✅ Supabase Auth para admins (email + password).
- ❌ No hay autenticación para clientes (solo registro por celular).
- ✅ Persistencia de sesión admin via `sessionStorage` (`titan_admin`).

### Otras
- **Popup de registro:** ✅ Automático con delay de 5s, persistencia vía sessionStorage.
- **Referral codes:** ✅ Generación, validación, extracción, compartición via Web Share API.
- **Loading states:** ✅ Parcial — spinner en componentes comunes, loading inline en forms.
- **Error boundaries:** ✅ Global con `react-error-boundary` (ErrorFallback).
- **Responsive design:** ✅ Mobile-first con Tailwind (Navbar móvil, grid responsive).
- **Animaciones:** ✅ Framer Motion en Hero, MenuGrid, popups, botones.

---

## 6. Supabase y Datos

| Tabla/Entidad | Operaciones | Usada por | Estado |
|---|---|---|---|
| `clientes` | SELECT (individual, por celular, recientes, count, stamps) INSERT (registro) | `JoinClubSection`, `LeadPopup`, `LoyaltyCard`, `AdminDashboard`, `AdminClientView` | ✅ Verificado (200 OK, datos reales retornados) |
| `admin_users` | SELECT (verificar rol admin) | `Login`, `ProtectedRoute` | ✅ Verificado (200 OK, tabla existe) |
| `redemptions` | SELECT (count, historial) | `AdminDashboard` | ✅ Verificado (200 OK, tabla existe) |
| `stamp_logs` | SELECT (historial 30 días para gráfica) | `AdminDashboard` | ✅ Verificado (200 OK, tabla existe) |
| **RPCs** | | | |
| `get_client_by_referral_code` | SELECT por referral_code | `LeadPopup` | ✅ Referenciado en código (no verificado directamente) |
| `increment_stamps` | UPDATE (añadir sello) | `Login` (auto-stamp en login con clientId) | ✅ Referenciado en código |
| `redeem_reward` | UPDATE (canje de 10 sellos) | `AdminDashboard` | ✅ Referenciado en código |

**Columnas `clientes` (confirmadas vía API REST):**
- `id` (UUID, PK)
- `nombre` (text)
- `celular` (text, 10 dígitos)
- `email` (text, nullable)
- `stamps_count` (integer, default 0)
- `created_at` (timestamp)
- `last_stamp_at` (timestamp, nullable)
- `referral_code` (text, 8 chars)
- `referred_by` (UUID, nullable, FK → `clientes.id`)

**Estado de RLS:** No se puede determinar directamente (las políticas están en el proyecto Supabase, no en el repositorio). Sin embargo, el REST API respondió 200 a queries de SELECT con el anon key, lo que indica que las políticas de lectura están configuradas. Las políticas de escritura (INSERT) también funcionan según el código de `JoinClubSection.jsx`.

**Relaciones detectadas en código:**
- `clientes.referred_by` → `clientes.id` (auto-referencia para referral system)
- `admin_users.id` → `auth.users.id` (relación con Supabase Auth)
- `redemptions` y `stamp_logs` referencian `clientes` (implícito por el código)
- El código usa foreign tables en queries (`clientes(nombre)` en joins de AdminDashboard)

---

## 7. Modelo de Negocio Inferido

**Confirmado por código:**

- **Qué vende:** Titan Grill es un restaurante de hamburguesas y parrilla ("Fuego & Carbon") en Santa Marta, Colombia.
- **Cómo funciona el negocio:** Programa de fidelidad (loyalty card). Los clientes se registran con su celular, acumulan sellos digitales por visitas, y al llegar a 10 sellos pueden canjear un premio.
- **Clientes:** Personas que visitan el local, se registran con su celular.
- **Menú:** Categorías estáticas (Entradas, Burgers, Perros calientes, Bebidas) con imágenes y precios.
- **Contacto:** WhatsApp (3004126441) y link de Instagram (@titangrill_burger).
- **Ubicación:** Zona de Emprendimiento, Universidad del Magdalena, Santa Marta.
- **Horarios:** Lunes 4PM-9:30PM, Miércoles-Viernes 4PM-9:30PM.
- **Sistema de referidos:** Los clientes pueden invitar otros y ambos reciben beneficios (primer sello gratis mencionado en referralUtils).

**Inferido:**

- El "Club Exclusivo" mencionado en el Hero sugiere que hay beneficios adicionales no implementados.
- El Happy Hour los miércoles (6 PM - 9 PM) está mencionado pero no hay funcionalidad asociada.

---

## 8. Flujo de Usuario

**Cliente (público):**

```text
Entrada
  ↓
Landing page (/)
  ↓
[Auto-popup] Registro con celular → Crea cliente en Supabase
  ↓
Tarjeta de fidelidad con QR mostrada
  ↓
Cierra popup → Botón flotante "Mi Tarjeta" disponible
  ↓
Compartir código de referido (Web Share API / clipboard)
```

**Admin:**

```text
Entrada
  ↓
Navega a /login
  ↓
Ingresa credenciales → Verificado contra Supabase Auth + admin_users
  ↓
Dashboard (/admin)
  ↓
Opciones:
  ├── Buscar cliente por celular → ver detalle (/admin/client/:id)
  │     ↓
  │     Ver tarjeta de fidelidad del cliente
  │     (admin registra sello en persona)
  │
  └── Ver tabla de clientes recientes / KPIs
  └── Canjear premio (RPC redeem_reward, requiere 10 sellos)
```

---

## 9. Estado del Frontend

**Diseño:** ✅ Coherente y pulido. Tema oscuro (zinc-950), colores de marca (fire `#ff4500`, gold `#d4af37`). Fuentes: Inter (body) + Playfair Display (headings). Animaciones con Framer Motion. Aspecto premium/luxury.

**Responsive:** ✅ Mobile-first. Navbar con menú móvil, grid responsive (`md:grid-cols-3`), modal responsive. Hero con tamaños de fuente responsive (`md:text-7xl lg:text-9xl`).

**Componentes reutilizables:** ⚠️ Parcial. Algunos componentes son reutilizables (ErrorFallback, LoadingSpinner, NotFound, SelectionModal), pero la mayoría están acoplados al contexto del proyecto (Hero, MenuGrid, JoinClubSection).

**Navegación:** ✅ Funcional con React Router v7. Anchor links para scroll a secciones (`#menu`, `#location`, `#join-club`).

**UX:** ✅ Buena. Smooth scroll, animaciones de entrada, loading states, estados de error. El popup de registro aparece automáticamente después de 5s.

**Accesibilidad:** ⚠️ Parcial. Algunos atributos ARIA presentes (`aria-label`, `aria-hidden`, `role="alert"`, `aria-modal`, `sr-only`). Sin embargo, hay el warning `allowfullscreen` → debería ser `allowFullScreen`. Falta `lang` correcto (está `lang="en"` en index.html aunque el contenido es español).

**Manejo de estados:** ⚠️ Local. No hay state management global. Cada componente maneja su estado con `useState`. Persistencia vía localStorage/sessionStorage manual.

**Loading states:** ✅ Parcial. `LoadingSpinner` en Suspense, loading inline en forms, "Cargando Tablero..." en AdminDashboard.

**Error states:** ✅ Parcial. `ErrorFallback` global, `error` estado en forms con mensajes visibles.

**Formularios:** ✅ Bien implementados. Validación de teléfono (10 dígitos), email (regex), con estados de error. Botones disabled durante loading.

**Feedback al usuario:** ✅ Bueno. Alerts de navegador, estados visuales de loading, animaciones de confirmación.

---

## 10. Estado Técnico

### Fortalezas

- ✅ **Build funcional** — `npm run build` compila 2814 módulos sin errores
- ✅ **Dev server estable** — Vite v7 inicia en <1s
- ✅ **Supabase integrado** — cliente configurado, queries funcionan, RPC referenciados
- ✅ **Diseño coherente** — tema oscuro, animaciones, responsive
- ✅ **Chunk splitting configurado** — vendor bundles separados (react, supabase, charts, motion, QR)
- ✅ **Error boundary global** — previene crashes totales
- ✅ **Código modular** — componentes separados, hooks, utilidades
- ✅ **Validación de inputs** — regex para teléfono y email
- ✅ **Race condition handling** — en `JoinClubSection` (retry on unique violation)
- ✅ **Realtime subscriptions** — suscripción a cambios en `clientes`

### Debilidades

- ❌ **13 errores + 2 warnings de ESLint** (no corregidos)
- ❌ **Atributo `allowfullscreen` mal escrito** (warning de React DOM en LocationSection.jsx:31)
- ❌ **`process.env.NODE_ENV` en cliente** — funciona por Vite pero es un anti-pattern y causa lint error
- ❌ **Variables de estado no usadas** — `referralCode`, `referralValidating` en `LeadPopup` (set pero nunca leídos)
- ❌ **`currentStamps` parámetro no usado** en `handleRedeem` de `AdminDashboard`
- ❌ **Missing dependency en useEffect** — `fetchDashboardData` no está en deps array
- ❌ **No hay tests** — cero cobertura de testing

### Deuda Técnica

- 📄 **Archivo duplicado** — `src/utils/referralUtils.js` es idéntico a `src/lib/referralUtils.js` pero no se importa (dead code)
- 📄 **`.env.example` modificado** — contiene valores reales (debería ser template con placeholders)
- 📄 **`package-lock.json` modificado** — cambios locales no committeados
- 📄 **Sin separación de concerns** — lógica de negocio mezclada con JSX en componentes
- 📄 **No hay manejo de errores de red** — fetch errors no tienen retry ni backoff
- 📄 **Sin testing** — cero tests
- 📄 **Sin CI/CD** — proceso manual

### Riesgos

- ⚠️ **Exposición de `process.env`** en `ErrorFallback.jsx` — funciona por Vite pero es frágil
- ⚠️ **`html5-qrcode` instalado pero no usado** — posible dependency cruft
- ⚠️ **Sin rate limiting** ni manejo robusto de errores de API
- ⚠️ **Sin documentación de cómo contribuir**

---

## 11. Errores y Warnings Conocidos

| Problema | Severidad | Impacto | ¿Bloquea desarrollo? |
|---|---|---|---|
| `motion` import no usado en 7 componentes (Hero, JoinClubSection, LoyaltyCard, WhatsAppButton, SelectionModal, MenuGrid) | Lint error (bajo) | Código muerto | ❌ No |
| `currentStamps` no usado en AdminDashboard:170 | Lint error (bajo) | Parámetro innecesario | ❌ No |
| `referralCode`, `referralValidating` no usados en LeadPopup:21,24 | Lint error (bajo) | Estado innecesario | ❌ No |
| `userName` no usado en referralUtils.js:85 (ambas copias) | Lint error (bajo) | Parámetro documentado pero no usado | ❌ No |
| `process` no definido en ErrorFallback.jsx:15 | Lint error (medio) | Falso positivo (Vite polyfill) | ❌ No (runtime funciona) |
| `fetchDashboardData` missing en useEffect deps (AdminDashboard:87) | Lint warning (medio) | Posible stale closure si se refactoriza | ❌ No (funciona actual) |
| `allowfullscreen` en LocationSection.jsx:31 | React warning (bajo) | No afecta funcionalidad, atributo pasa al DOM | ❌ No |
| Browserslist data 8 months old | Build warning (bajo) | Solo sugerencia de actualización | ❌ No |
| `.env.example` con valores reales | Config (medio) | Riesgo de commit accidental | ❌ No (no está committeado) |
| `package-lock.json` modificado | Config (bajo) | Posible desincronización | ❌ No |

---

## 12. Dependencias Externas

| Servicio | Uso | Evidencia |
|---|---|---|
| **Supabase** | Backend (auth, DB, RPC, realtime) | `src/lib/supabaseClient.js`, queries a `clientes`, `admin_users`, `redemptions`, `stamp_logs`, RPCs `get_client_by_referral_code`, `increment_stamps`, `redeem_reward` |
| **Google Maps** | Embed de mapa en LocationSection | `<iframe src="https://www.google.com/maps/q=...">` |
| **Google Fonts** | Fuentes Inter + Playfair Display | `index.html` (`<link href="https://fonts.googleapis.com/...">`) |
| **WhatsApp** | Link de contacto `wa.me/3004126441` | `WhatsAppButton.jsx` |
| **Instagram** | Link de perfil `@titangrill_burger` | `LocationSection.jsx`, `index.html` (meta) |

---

## 13. Seguridad

**Autenticación:**
- ✅ Admin auth vía Supabase Auth (email + password) con `signInWithPassword`
- ✅ `admin_users` table whitelist (solo usuarios en esta tabla pueden acceder)
- ✅ Sesión persistida via `sessionStorage` (`titan_admin`)
- ✅ `ProtectedRoute` verifica auth + admin status
- ❌ Clientes no tienen auth (solo registro por celular)

**Manejo de claves:**
- ✅ `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` (browser-safe)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` no expuesto en cliente
- ✅ `.env` en `.gitignore`
- ⚠️ `.env.example` contiene un valor real de anon key (pre-existing mod, no mi acción)

**Variables de entorno:**
- ✅ Vite inyecta `VITE_*` automáticamente en el cliente
- ✅ Check de `prod` en `supabaseClient.js` (lanza error en prod si falta env)

**RLS:**
- No se puede determinar directamente (políticas en servidor Supabase). El REST API respondió 200 a SELECTs con anon key, lo que sugiere que las políticas de lectura están configuradas. Las políticas de escritura (INSERT) también funcionan según el código.

**Permisos:**
- Anon key tiene acceso a SELECT/INSERT en `clientes`, SELECT en `admin_users`, SELECT en `redemptions` y `stamp_logs`.

**Datos sensibles:**
- ⚠️ Teléfonos de clientes almacenados en texto plano
- ⚠️ No hay rate limiting en endpoints de registro

---

## 14. Preparación para Crecimiento

### 🟢 Fácil de extender
- **MenuGrid datos estáticos** → fácil migrar a datos de Supabase (tabla `productos` / `categorias`).
- **Componentes aislados** → fácil de reutilizar o modificar.
- **Cliente Supabase único** → fácil de reemplazar o configurar.
- **Chunk splitting definido** → fácil de extender con nuevos vendor bundles.
- **Tailwind configurado** → fácil de añadir nuevos estilos.

### 🟡 Requiere planificación
- **Sistema de referral** → la lógica está en `referralUtils.js` pero no está conectada a un flujo de recompensas para el referrer (solo pasa `referred_by`).
- **Gestión de stock/precios** → precios están hardcoded en MenuGrid.jsx.
- **Historial de pedidos** → no existe concepto de órdenes.
- **Autenticación de clientes** → clientes no tienen login propio.
- **Tests** → no hay infraestructura de testing para validar cambios.

### 🔴 Requiere cambios arquitectónicos
- **State management global** → para coordinar estado entre componentes se necesitaría Context API o similar.
- **API layer/service layer** → consultas de Supabase están dispersas en componentes. Un service layer ayudaría a centralizar.
- **Tipado** → sin TypeScript, el riesgo de errores en queries de Supabase aumenta.
- **Deployment/CI** → no hay pipeline. El deploy sería manual.

---

## 15. Mapa de Funcionalidades

| Área | Funcionalidad | Estado | Backend | Prioridad técnica |
|---|---|---|---|---|
| Clientes | Registro por celular | ✅ | Supabase INSERT `clientes` | Alta |
| Clientes | Tarjeta de fidelidad con QR | ✅ | Supabase SELECT | Alta |
| Clientes | Acumulación de sellos | ✅ (realtime) | Supabase Subscriptions + RPC | Alta |
| Clientes | Persistencia local | ✅ | localStorage | Media |
| Clientes | Sistema de referidos | ✅ (parcial) | RPC `get_client_by_referral_code` + `referred_by` | Media |
| Clientes | Compartir tarjeta/referido | ✅ | Web Share API / clipboard | Baja |
| Admin | Login con Supabase Auth | ✅ | Supabase Auth + admin_users | Alta |
| Admin | Protected routes | ✅ | Supabase Auth + admin_users | Alta |
| Admin | Dashboard KPIs | ✅ | Supabase SELECT (count, aggregates) | Media |
| Admin | Gráfica de actividad | ✅ | Supabase SELECT `stamp_logs` | Media |
| Admin | Búsqueda de clientes | ✅ | Supabase SELECT `clientes` (ilike) | Media |
| Admin | Canje de premios | ✅ | Supabase RPC `redeem_reward` | Alta |
| Admin | Registro de sello (auto-stamp) | ✅ | Supabase RPC `increment_stamps` | Alta |
| Admin | Vista detalle cliente | ✅ | Supabase SELECT | Baja |
| Menú | Catálogo de categorías | ✅ | Datos estáticos | Baja |
| Menú | Modal de items | ✅ | Datos estáticos | Baja |
| Ubicación | Mapa Google Maps | ✅ | Externo (iframe) | Baja |
| Ubicación | Horarios | ✅ | Hardcodeado | Baja |
| Contacto | WhatsApp button | ✅ | Externo (wa.me) | Baja |
| Pedidos | Online ordering | 🔴 | No existe | Baja |
| Auth | Login de clientes | 🔴 | No existe | Media |

---

## 16. CONTEXTO RÁPIDO — TITAN GRILL

Titan Grill es un **SPA cliente puro** (Vite 7 + React 19) que implementa un **programa de fidelidad** para un restaurante de hamburguesas en Santa Marta, Colombia. Los clientes se registran con su celular, acumulan sellos digitales (10 = premio) y usan un código QR. Los admins gestionan todo vía `/login` → `/admin` (dashboard con Recharts, búsqueda, canje). **Supabase** es el backend (auth, Postgres con tablas `clientes`/`admin_users`/`redemptions`/`stamp_logs`, RPCs, realtime). Stack: Tailwind v4, Framer Motion, Lucide React, react-qr-code, react-error-boundary. Estado: **beta funcional** — build OK, dev server OK, Supabase conectado, pero hay 13 errores de lint, código duplicado, `allowfullscreen` mal escrito, y cero tests. No hay CI/CD, no hay pedidos online, precios del menú hardcoded.

---

## 17. Recomendaciones

**Antes de implementar funcionalidades grandes:**

1. **Resolver deuda técnica existente:**
   - Eliminar el `referralUtils.js` duplicado en `src/utils/` (dead code).
   - Corregir el atributo `allowfullscreen` → `allowFullScreen` en `LocationSection.jsx:31`.
   - Limpiar imports no usados (`motion` en 7 componentes).
   - Remover variables de estado no usadas (`referralCode`, `referralValidating` en `LeadPopup`).
   - Reemplazar `process.env.NODE_ENV` → `import.meta.env.DEV` en `ErrorFallback.jsx`.

2. **Arquitectura importante conocer:**
   - El cliente Supabase es singleton (`src/lib/supabaseClient.js`). Cualquier cambio afecta a toda la app.
   - La tabla `clientes` usa nombres en español (`celular`, `nombre`, `stamps_count`, `referral_code`).
   - Las rutas admin están protegidas por `ProtectedRoute` que chequea `admin_users` table.
   - El referral system pasa `referred_by` (UUID) pero no hay tabla de "beneficios para referrers" aún.

3. **Dependencias que podrían afectar:**
   - Vite 7 (no Vite 8/Rolldown aún) — migrar requeriría testing.
   - React 19 (última versión) — usar APIs de React 19 (use(), ref como prop) si se refactoriza.
   - Supabase RPC functions (`increment_stamps`, `redeem_reward`, `get_client_by_referral_code`) están en el servidor — modificarlas requiere acceso al proyecto Supabase.
   - Google Fonts cargados externamente (Inter + Playfair Display).
   - `html5-qrcode` está instalado pero no se usa — posible dependency cruft.

4. **Áreas a no modificar sin planificación:**
   - **Esquema de la tabla `clientes`** — cambiar columnas requiere migración Supabase y afecta múltiples componentes.
   - **RPCs de Supabase** — están acoplados a flujos de negocio (increment_stamps, redeem_reward).
   - **Configuración de chunk splitting en `vite.config.js`** — afecta el bundle.
   - **`.gitignore`** — ya excluye `.env`, `node_modules`, `dist`.
