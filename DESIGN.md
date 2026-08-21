# Widget Shop — Design & Requirements

## 1. Overview

Widget Shop is a simple e-commerce sample application used for remediation-engineer training. It lets customers register, browse a catalog of widgets, add items to a cart, and check out with a credit card processed by a **third-party external payment processor** (e.g. a Stripe-style gateway). Backend admins manage the catalog and pricing; a customer service role handles refunds and exchanges.

The app is a **Single Page Application (SPA)** frontend backed by a **REST API**, with a **SQL database** for persistence, and is deployed as a set of **Docker containers**.

This document intentionally leaves some implementation details open (they are filled in by the training scenarios), but defines enough structure — data model, API surface, roles, and flows — to build a working, realistic app that can later have vulnerabilities introduced/remediated.

---

## 2. Goals / Non-Goals

**Goals**
- Realistic, small-scope e-commerce app: auth, catalog, cart, checkout, order history, refunds/exchanges.
- Clear separation of roles: Customer, Admin, Customer Service.
- Simple enough to reason about end-to-end (schema, API, UI) for training purposes.
- Integration with a real external payment processor's API surface (tokenization, charge, refund).

**Non-Goals**
- No PCI compliance program to build/audit ourselves — card data is tokenized directly with the processor, minimizing our PCI scope.
- No multi-tenancy, internationalization, tax calculation, or shipping-carrier integration.
- No high-availability / scaling concerns — this is a training sample, not production infrastructure.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | SPA (React or similar), calling the backend via JSON REST API |
| Backend | Node.js API server (e.g. Express) |
| Database | SQL (PostgreSQL or SQLite for local/dev) via an ORM/query builder |
| Auth | Session- or JWT-based auth, password hashing (bcrypt/argon2) |
| Email | Transactional email provider (SMTP relay or API), used to deliver password-reset links |
| Payments | Real external payment processor (e.g. Stripe-style gateway), accessed over HTTPS via a thin client module |
| Deployment | Docker containers, orchestrated via Docker Compose |

---

## 3.1 Architecture Diagram

The following diagram reflects the containers described in §3 and §11: a browser-hosted SPA, an API server backed by a SQL database, and a **real, third-party payment processor** that lives outside our infrastructure. The SPA talks to the processor directly for tokenization, and the API talks to it server-to-server for charges/refunds.

```mermaid
flowchart TB
    subgraph clients["Clients"]
        guest["Guest"]
        customer["Customer"]
        admin["Admin"]
        cs["Customer Service"]
    end

    subgraph dockerhost["Docker Compose Environment (our infrastructure)"]
        subgraph webc["web container"]
            spa["SPA (React)\nstatic build served via nginx"]
        end

        subgraph apic["api container"]
            api["REST API (Node.js / Express)\nauthN/authZ, business logic"]
        end

        subgraph dbc["db container"]
            db[("SQL Database\nPostgreSQL")]
        end

        migrate["migrate (one-shot)\nruns schema migrations/seed"]
    end

    processor["Payment Processor\n(external third-party gateway,\ne.g. Stripe-style)"]

    guest -->|HTTPS| spa
    customer -->|HTTPS| spa
    admin -->|HTTPS| spa
    cs -->|HTTPS| spa

    spa -->|"JSON REST API\n(auth, catalog, cart, orders)"| api
    spa -->|"POST /tokenize\n(card details, direct from browser)"| processor

    api -->|"parameterized SQL"| db
    api -->|"POST /charge, POST /refund\n(server-to-server, over the internet)"| processor

    migrate -->|"schema migrations"| db
    migrate -.->|"must complete before api serves traffic"| api

    style processor fill:#fee,stroke:#900
    style dbc fill:#eef,stroke:#339
```

Key architectural points from this document:
- The SPA never routes raw card data through the API (§6) — it goes browser → payment processor directly, returning only an opaque `card_token`.
- The payment processor is an **external system outside our trust boundary**, reached over the public internet — not a container we operate (§11.1).
- The API is the sole client of the database and is the actual authorization boundary (§4) even though the SPA also hides unauthorized UI.
- `db` is not published to the host; only `api` can reach it (§11.2).
- `migrate` must complete before `api` accepts traffic (§11.4, §11.7.5).

---

## 4. Roles & Permissions

| Role | Capabilities |
|---|---|
| **Guest** | Browse catalog, view widget details, register, log in |
| **Customer** | Everything Guest can do, plus: manage own profile/addresses, manage cart, checkout, view own order history, request a return/exchange |
| **Admin** | Manage catalog (create/edit/delete widgets, set prices, manage inventory/stock), manage widget categories, view all orders (read-only), manage user role assignments |
| **Customer Service (CS)** | View all orders and customers, issue refunds (full/partial) against an order/payment, process exchanges (accept returned item, ship replacement / adjust order), add internal notes to an order |

Role checks are enforced **server-side** on every API endpoint — the SPA hides UI it shouldn't show, but the API is the actual authorization boundary.

Admin and CS accounts are internal/staff accounts, not self-service registrations — they're provisioned by an existing Admin.

---

## 5. Core Domain / Data Model

The full set of tables, columns, types, and foreign keys is captured in the ER diagram below (§5.1). A few business rules aren't visible from column names alone and are called out here:

- **`users.role`** defaults to `customer`; `admin` and `customer_service` are staff-provisioned (§4).
- **`widgets.is_active`** is a soft "delisting" flag — widgets are never hard-deleted.
- **Carts**: one active cart per user (or session for guests, if guest carts are supported — otherwise require login before cart use).
- **`cart_items.unit_price_cents`**: recommend **re-pricing at checkout** from `widgets.price_cents` rather than trusting a price snapshotted at add-time, to avoid stale-price abuse.
- **`order_items.unit_price_cents`** is immutable once set — it is the price at time of purchase and is never affected by later catalog price changes.
- **`password_reset_tokens`** are single-use and time-limited: a token is stored hashed (never plaintext), carries an `expires_at`, and is marked used (or deleted) the moment it's redeemed or superseded by a newer request.
- **`users.failed_login_attempts` / `locked_until`** implement account lockout: consecutive failed logins increment the counter; reaching a configured threshold sets `locked_until` (a cooldown period) and further login attempts are rejected until it elapses. A successful login resets the counter.
- **No table ever stores a full card number, CVV, or expiration date.** Only the processor's opaque token (`payments.processor_card_token`) and display metadata (`card_last4`, `card_brand`) are persisted, consistent with basic PCI-DSS scope reduction.

### 5.1 Proposed ER Diagram

```mermaid
erDiagram
    USERS ||--o{ ADDRESSES : owns
    USERS ||--o{ CARTS : owns
    USERS ||--o{ ORDERS : places
    USERS ||--o{ REFUNDS : "issues (CS)"
    USERS ||--o{ EXCHANGES : "processes (CS)"
    USERS ||--o{ PASSWORD_RESET_TOKENS : requests

    CATEGORIES ||--o{ WIDGETS : categorizes
    USERS ||--o{ WIDGETS : "created/updated by (admin)"

    CARTS ||--o{ CART_ITEMS : contains
    WIDGETS ||--o{ CART_ITEMS : "referenced by"

    ADDRESSES ||--o{ ORDERS : "ships to"
    ORDERS ||--o{ ORDER_ITEMS : contains
    WIDGETS ||--o{ ORDER_ITEMS : "referenced by"

    ORDERS ||--o| PAYMENTS : "paid via"
    PAYMENTS ||--o{ REFUNDS : "refunded via"
    ORDERS ||--o{ REFUNDS : "refunded on"

    ORDERS ||--o{ EXCHANGES : "exchanged on"
    WIDGETS ||--o{ EXCHANGES : "returned/replacement item"

    USERS {
        id id PK
        string email UK
        string password_hash
        string full_name
        enum role "customer, admin, customer_service"
        int failed_login_attempts "default 0"
        timestamp locked_until "nullable"
        timestamp created_at
    }

    ADDRESSES {
        id id PK
        id user_id FK
        string line1
        string line2
        string city
        string state
        string postal_code
        string country
        bool is_default_shipping
        bool is_default_billing
    }

    CATEGORIES {
        id id PK
        string name UK
    }

    WIDGETS {
        id id PK
        string sku UK
        string name
        text description
        int price_cents
        string currency
        int stock_quantity
        id category_id FK
        string image_url
        bool is_active
        id created_by FK
        id updated_by FK
        timestamp created_at
        timestamp updated_at
    }

    CARTS {
        id id PK
        id user_id FK
    }

    CART_ITEMS {
        id id PK
        id cart_id FK
        id widget_id FK
        int quantity
        int unit_price_cents
    }

    ORDERS {
        id id PK
        id user_id FK
        enum status "pending_payment, paid, refunded, partially_refunded, exchange_pending, exchanged, cancelled"
        int subtotal_cents
        int total_cents
        id shipping_address_id FK
        id payment_id FK
        timestamp created_at
    }

    ORDER_ITEMS {
        id id PK
        id order_id FK
        id widget_id FK
        int quantity
        int unit_price_cents "immutable"
    }

    PAYMENTS {
        id id PK
        id order_id FK
        string processor_transaction_id
        string processor_card_token
        int amount_cents
        enum status "authorized, captured, failed, refunded, partially_refunded"
        string card_last4
        string card_brand
        timestamp created_at
    }

    REFUNDS {
        id id PK
        id order_id FK
        id payment_id FK
        id issued_by FK
        int amount_cents
        text reason
        string processor_refund_id
        timestamp created_at
    }

    EXCHANGES {
        id id PK
        id order_id FK
        id processed_by FK
        id returned_widget_id FK
        int returned_quantity
        id replacement_widget_id FK
        int replacement_quantity
        enum status "requested, received, completed, rejected"
        text notes
        timestamp created_at
        timestamp updated_at
    }

    PASSWORD_RESET_TOKENS {
        id id PK
        id user_id FK
        string token_hash
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }
```

This diagram is a direct rendering of the tables and foreign keys defined above (§5); it does not introduce any structure not already specified there.

---

## 6. Payment Processor Integration

The application integrates with a **real, external, third-party payment processor** (e.g. a Stripe-style gateway) over HTTPS, accessed from the backend through an internal client module (`services/paymentClient.js` or similar). The integration surface:

- `POST /tokenize` — accepts card details **directly from the client-side SPA to the processor**, never through our backend, returning a `card_token`. (This mirrors real-world practice: our server never sees/touches raw PAN, minimizing our PCI scope.)
- `POST /charge` — backend calls with `{ card_token, amount_cents, currency, order_id }`, returns `{ transaction_id, status, last4, brand }`.
- `POST /refund` — backend calls with `{ transaction_id, amount_cents }`, returns `{ refund_id, status }`.

This integration surface is intentionally modeled on how real gateways work (client-side tokenization, server-side charge/refund) rather than being a bespoke protocol, so the app's behavior generalizes to whichever real processor a deployment chooses. See §10 for how this integration is tested without moving real money.

---

## 7. Key Flows

### 7.1 Registration / Login
1. Guest submits email/password (+ name) → server hashes password, creates `users` row with role `customer`.
2. Login validates credentials, issues session/JWT. See §7.1c for the account-lockout behavior applied on repeated failures.

### 7.1a Forgot / Reset Password
1. Guest submits their email on a "forgot password" form.
2. Server looks up the user; regardless of whether a match is found, it returns the same generic response (to avoid leaking which emails are registered).
3. If a match is found, server generates a single-use, time-limited reset token, stores only its hash in `password_reset_tokens` (with `expires_at`), and emails a reset link containing the plaintext token to the user's registered email address via the transactional email provider.
4. User follows the link, submits a new password (+ the token from the link).
5. Server validates the token (exists, unexpired, unused), hashes the new password, updates `users.password_hash`, marks the token used, and invalidates the user's other active sessions.

### 7.1b Change Password
1. Authenticated customer submits their current password and a new password from their account settings.
2. Server re-verifies the current password against `users.password_hash` before allowing the change (prevents a hijacked session with a stolen token/cookie, but no credentials, from silently taking over the account).
3. On success: server hashes and stores the new password, and invalidates the user's other active sessions.
4. On failure (current password incorrect): request rejected, password unchanged.

### 7.1c Account Lockout / Login
1. Login request arrives with email + password.
2. Server looks up the user and first checks `locked_until`: if it's set and still in the future, the request is rejected immediately (generic "account temporarily locked, try again later" response) — the password is not checked.
3. Otherwise, server verifies the password:
   - **Incorrect**: increment `failed_login_attempts`. If the new count reaches the configured threshold (e.g. 5), set `locked_until` to now + a cooldown window (e.g. 15 minutes). Respond with a generic "invalid email or password" error either way (the account-locked message is only shown once the threshold is actually hit, on that same response).
   - **Correct**: reset `failed_login_attempts` to 0, clear `locked_until`, issue a session/JWT.

### 7.2 Browse Catalog
- Public endpoint lists active widgets, filterable by category, searchable by name; widget detail view shows description/price/stock.

### 7.3 Cart & Checkout
1. Authenticated customer adds/updates/removes items in their cart.
2. On checkout: customer supplies shipping address and card details (entered directly into a payment-processor-hosted field/component in the SPA → tokenized client-side).
3. SPA sends `card_token` + cart + shipping address to backend `POST /orders`.
4. Backend re-prices cart from current `widgets.price_cents`, creates `orders` (status `pending_payment`) + `order_items`, calls the payment processor `/charge`.
5. On success: create `payments` row, set order status `paid`, decrement `stock_quantity`, clear cart.
6. On failure: order marked failed/cancelled, customer notified, cart preserved.

### 7.4 Admin — Catalog Management
- Admin creates/edits widgets (name, description, price, stock, category, image, active flag).
- Price changes only affect future carts/orders (existing `order_items.unit_price_cents` are immutable history).

### 7.5 Customer Service — Refunds
1. CS looks up an order (by order id, customer email, etc.).
2. CS issues a full or partial refund with a reason.
3. Backend calls the payment processor `/refund` for `amount_cents` against the original `processor_transaction_id`.
4. On success: create `refunds` row, update `payments.status` and `orders.status` (`refunded`/`partially_refunded`).

### 7.6 Customer Service — Exchanges
1. Customer (or CS on their behalf) requests an exchange on a delivered order, specifying returned item(s) and desired replacement.
2. CS marks the return `received` once the item is physically back.
3. CS completes the exchange: system creates/updates the replacement shipment; if replacement price differs from returned item, CS issues a partial refund or requests an additional payment (via a new charge through the payment processor) to settle the difference.
4. Order/exchange status updated to `completed`.

---

## 7.7 Sequence Diagrams

### 7.7.1 Registration / Login (§7.1)

```mermaid
sequenceDiagram
    actor Guest
    participant SPA
    participant API
    participant DB

    Guest->>SPA: Enter email, password, name
    SPA->>API: POST /api/auth/register
    API->>API: Hash password (bcrypt/argon2)
    API->>DB: INSERT users (role=customer)
    DB-->>API: user row
    API-->>SPA: 201 Created
    SPA-->>Guest: Registration confirmed

    Guest->>SPA: Enter email, password
    SPA->>API: POST /api/auth/login
    API->>DB: SELECT user by email
    DB-->>API: user row (password_hash)
    API->>API: Verify password hash
    API->>API: Issue session/JWT
    API-->>SPA: 200 OK + session/JWT
    SPA-->>Guest: Logged in
```

### 7.7.2 Browse Catalog (§7.2)

```mermaid
sequenceDiagram
    actor User as Guest/Customer
    participant SPA
    participant API
    participant DB

    User->>SPA: Browse / search catalog
    SPA->>API: GET /api/widgets?category=&q=
    API->>DB: SELECT active widgets (filtered)
    DB-->>API: widget rows
    API-->>SPA: 200 OK (widget list)
    SPA-->>User: Render catalog

    User->>SPA: Open widget detail
    SPA->>API: GET /api/widgets/:id
    API->>DB: SELECT widget by id
    DB-->>API: widget row
    API-->>SPA: 200 OK (widget detail)
    SPA-->>User: Render detail page
```

### 7.7.3 Cart & Checkout (§7.3)

```mermaid
sequenceDiagram
    actor Customer
    participant SPA
    participant Processor as Payment Processor
    participant API
    participant DB

    Customer->>SPA: Add/update/remove cart items
    SPA->>API: POST/PATCH/DELETE /api/cart/items
    API->>DB: Upsert cart_items
    DB-->>API: ack
    API-->>SPA: 200 OK (cart state)

    Customer->>SPA: Enter shipping address + card details
    SPA->>Processor: POST /tokenize (card details, direct from browser)
    Processor-->>SPA: card_token

    SPA->>API: POST /api/orders {card_token, cart, shipping_address}
    API->>DB: Re-price cart from widgets.price_cents
    API->>DB: INSERT orders (status=pending_payment) + order_items
    DB-->>API: order row

    API->>Processor: POST /charge {card_token, amount_cents, order_id}
    alt charge succeeds
        Processor-->>API: {transaction_id, status, last4, brand}
        API->>DB: INSERT payments row
        API->>DB: UPDATE orders SET status=paid
        API->>DB: Decrement widgets.stock_quantity
        API->>DB: Clear cart
        API-->>SPA: 201 Created (order confirmed)
        SPA-->>Customer: Order confirmation
    else charge fails
        Processor-->>API: {status=failed}
        API->>DB: UPDATE orders SET status=cancelled/failed
        API-->>SPA: 402/4xx (payment failed)
        SPA-->>Customer: Show failure, cart preserved
    end
```

### 7.7.4 Admin — Catalog Management (§7.4)

```mermaid
sequenceDiagram
    actor Admin
    participant SPA
    participant API
    participant DB

    Admin->>SPA: Create/edit widget (name, price, stock, category, active flag)
    SPA->>API: POST/PATCH /api/admin/widgets(/:id)
    API->>API: Check role == admin
    API->>DB: INSERT/UPDATE widgets (created_by/updated_by)
    DB-->>API: widget row
    API-->>SPA: 200/201 OK
    SPA-->>Admin: Catalog updated

    Note over API,DB: Existing order_items.unit_price_cents are immutable
    Note over API,DB: price changes only affect future carts/orders
```

### 7.7.5 Customer Service — Refunds (§7.5)

```mermaid
sequenceDiagram
    actor CS as Customer Service
    participant SPA
    participant API
    participant Processor as Payment Processor
    participant DB

    CS->>SPA: Look up order (order id / customer email)
    SPA->>API: GET /api/cs/orders/:id
    API->>API: Check role == customer_service
    API->>DB: SELECT order, payment
    DB-->>API: order + payment rows
    API-->>SPA: 200 OK (order detail)

    CS->>SPA: Issue full/partial refund + reason
    SPA->>API: POST /api/cs/orders/:id/refunds {amount_cents, reason}
    API->>Processor: POST /refund {transaction_id, amount_cents}
    Processor-->>API: {refund_id, status}
    API->>DB: INSERT refunds (issued_by, amount_cents, reason, processor_refund_id)
    API->>DB: UPDATE payments.status, orders.status (refunded/partially_refunded)
    DB-->>API: ack
    API-->>SPA: 200 OK (refund recorded)
    SPA-->>CS: Refund confirmation
```

### 7.7.6 Customer Service — Exchanges (§7.6)

```mermaid
sequenceDiagram
    actor Customer
    actor CS as Customer Service
    participant SPA
    participant API
    participant Processor as Payment Processor
    participant DB

    Customer->>SPA: Request exchange (returned item, desired replacement)
    SPA->>API: POST /api/cs/orders/:id/exchanges
    API->>DB: INSERT exchanges (status=requested)
    DB-->>API: exchange row
    API-->>SPA: 201 Created

    CS->>SPA: Mark return received
    SPA->>API: PATCH /api/cs/exchanges/:id {status=received}
    API->>DB: UPDATE exchanges SET status=received
    DB-->>API: ack

    CS->>SPA: Complete exchange
    SPA->>API: PATCH /api/cs/exchanges/:id {status=completed}
    API->>DB: Create/update replacement shipment

    alt replacement price differs from returned item
        alt replacement cheaper
            API->>Processor: POST /refund (settle difference)
            Processor-->>API: {refund_id, status}
            API->>DB: INSERT refunds row
        else replacement more expensive
            API->>Processor: POST /charge (collect difference)
            Processor-->>API: {transaction_id, status}
            API->>DB: INSERT payments row
        end
    end

    API->>DB: UPDATE exchanges SET status=completed
    API->>DB: UPDATE orders.status accordingly
    DB-->>API: ack
    API-->>SPA: 200 OK
    SPA-->>CS: Exchange completed
```

### 7.7.7 Forgot / Reset Password (§7.1a)

```mermaid
sequenceDiagram
    actor Guest
    participant SPA
    participant API
    participant DB
    participant Email as Email Provider

    Guest->>SPA: Submit email ("forgot password")
    SPA->>API: POST /api/auth/forgot-password {email}
    API->>DB: SELECT user by email

    alt user found
        DB-->>API: user row
        API->>API: Generate single-use token, hash it
        API->>DB: INSERT password_reset_tokens {user_id, token_hash, expires_at}
        DB-->>API: ack
        API->>Email: Send reset link (plaintext token)
        Email-->>Guest: Reset password email
    else user not found
        DB-->>API: no match
        Note over API: No token generated
    end

    API-->>SPA: 200 OK (generic response either way)
    SPA-->>Guest: "If that email exists, a reset link was sent"

    Guest->>SPA: Open reset link, submit new password + token
    SPA->>API: POST /api/auth/reset-password {token, new_password}
    API->>DB: SELECT password_reset_tokens by token_hash
    DB-->>API: token row

    alt token valid (found, unexpired, unused)
        API->>API: Hash new password
        API->>DB: UPDATE users.password_hash
        API->>DB: UPDATE password_reset_tokens SET used_at=now
        API->>DB: Invalidate user's other active sessions
        DB-->>API: ack
        API-->>SPA: 200 OK (password reset)
        SPA-->>Guest: Redirect to login
    else token invalid/expired/used
        API-->>SPA: 400 Bad Request
        SPA-->>Guest: Show error, request a new link
    end
```

### 7.7.8 Change Password (§7.1b)

```mermaid
sequenceDiagram
    actor Customer
    participant SPA
    participant API
    participant DB

    Customer->>SPA: Submit current password + new password
    SPA->>API: POST /api/auth/change-password {current_password, new_password}
    API->>API: Check authenticated session
    API->>DB: SELECT user by session/JWT subject
    DB-->>API: user row (password_hash)
    API->>API: Verify current_password against password_hash

    alt current password correct
        API->>API: Hash new password
        API->>DB: UPDATE users.password_hash
        API->>DB: Invalidate user's other active sessions
        DB-->>API: ack
        API-->>SPA: 200 OK (password changed)
        SPA-->>Customer: Confirmation
    else current password incorrect
        API-->>SPA: 401/403 (incorrect current password)
        SPA-->>Customer: Show error, password unchanged
    end
```

### 7.7.9 Account Lockout / Login (§7.1c)

```mermaid
sequenceDiagram
    actor User as Guest/Customer
    participant SPA
    participant API
    participant DB

    User->>SPA: Submit email + password
    SPA->>API: POST /api/auth/login {email, password}
    API->>DB: SELECT user by email (failed_login_attempts, locked_until)
    DB-->>API: user row

    alt locked_until is set and in the future
        API-->>SPA: 423/429 "Account temporarily locked, try again later"
        SPA-->>User: Show lockout message
    else not locked
        API->>API: Verify password against password_hash

        alt password correct
            API->>DB: UPDATE users SET failed_login_attempts=0, locked_until=NULL
            API->>API: Issue session/JWT
            DB-->>API: ack
            API-->>SPA: 200 OK + session/JWT
            SPA-->>User: Logged in
        else password incorrect
            API->>DB: UPDATE users SET failed_login_attempts += 1
            DB-->>API: new attempt count

            alt attempt count reaches threshold (e.g. 5)
                API->>DB: UPDATE users SET locked_until = now + cooldown
                DB-->>API: ack
                API-->>SPA: 423/429 "Account temporarily locked"
                SPA-->>User: Show lockout message
            else below threshold
                API-->>SPA: 401 "Invalid email or password"
                SPA-->>User: Show generic error
            end
        end
    end
```

---

## 8. API Surface (representative, not exhaustive)

```
Auth
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/forgot-password   (request reset link, always generic response)
  POST   /api/auth/reset-password    (consume token, set new password)
  POST   /api/auth/change-password   (authenticated, requires current password)
  POST   /api/auth/logout

Catalog (public)
  GET    /api/widgets
  GET    /api/widgets/:id
  GET    /api/categories

Cart (customer)
  GET    /api/cart
  POST   /api/cart/items
  PATCH  /api/cart/items/:itemId
  DELETE /api/cart/items/:itemId

Checkout / Orders (customer)
  POST   /api/orders                 (checkout)
  GET    /api/orders                 (own order history)
  GET    /api/orders/:id

Admin (admin only)
  POST   /api/admin/widgets
  PATCH  /api/admin/widgets/:id
  DELETE /api/admin/widgets/:id
  POST   /api/admin/categories
  GET    /api/admin/orders           (read-only, all orders)
  PATCH  /api/admin/users/:id/role

Customer Service (customer_service only)
  GET    /api/cs/orders
  GET    /api/cs/orders/:id
  POST   /api/cs/orders/:id/refunds
  POST   /api/cs/orders/:id/exchanges
  PATCH  /api/cs/exchanges/:id
```

All non-public endpoints require authentication; role-restricted endpoints additionally check `role` server-side.

---

## 9. Functional Requirements Summary

1. Users can register and log in with email + password.
2. Any user (including guests) can browse and search the widget catalog.
3. Authenticated customers can add/update/remove items in a cart and check out.
4. Checkout requires a shipping address and a credit card, processed via the external payment processor; the app never stores raw card numbers.
5. Successful checkout creates an order and decrements stock; failed checkout leaves the cart intact.
6. Admins can create, edit, and deactivate widgets, including setting price and stock.
7. Admins can view all orders (read-only) and manage staff role assignments.
8. Customer Service agents can view any order, issue full/partial refunds with a reason, and process exchanges (return + replacement, with price-difference settlement).
9. Every refund/exchange records who performed it and when (audit trail).
10. Role-based access control is enforced on the backend for every state-changing operation.
11. Users can request a password reset email and set a new password via a single-use, time-limited link, without revealing whether a given email is registered.
12. Authenticated users can change their password by re-confirming their current password.
13. An account is temporarily locked out after a configured number of consecutive failed login attempts, and automatically unlocks after a cooldown period.

## 10. Non-Functional Requirements

- **Security**: password hashing, parameterized SQL (no string-concatenated queries), server-side authZ on every endpoint, no raw card data at rest, HTTPS assumed in deployment. Password reset tokens are single-use, time-limited, stored hashed, and the forgot-password endpoint is rate-limited and returns a uniform response to avoid user enumeration. Login enforces account lockout after repeated failed attempts to slow down credential-stuffing/brute-force attacks.
- **Data integrity**: order line items and prices are immutable once an order is placed; catalog price changes never retroactively alter past orders.
- **Auditability**: refunds and exchanges record the acting staff user, timestamp, and reason.
- **Testability**: the payment processor client is implemented behind an interface/module boundary so it can be pointed at the processor's sandbox/test mode, or replaced with a test double, for local development and automated tests — this is a testing concern and does not change the production architecture, which always talks to the real processor.

---

## 11. Deployment (Docker)

The application ships as a small set of containers, defined via a `docker-compose.yml` for local/training use (a production-style deployment would split these across separate hosts/services, but Compose is sufficient for this sample).

### 11.1 Containers

| Service | Image / Base | Notes |
|---|---|---|
| `web` | `node:XX-alpine` (multi-stage build) | Builds and serves the SPA (static build output served via nginx or a lightweight Node static server) |
| `api` | `node:XX-alpine` (multi-stage build) | Express API server |
| `db` | `postgres:XX-alpine` | SQL database, named volume for data persistence |
| `migrate` (optional, one-shot) | same image as `api` | Runs DB migrations/seed on startup, then exits |

The **payment processor is not a container in this Compose stack** — it is a real, external, third-party service reached over the public internet via HTTPS. Only `api` (server-to-server) and the browser running the SPA (for client-side tokenization) talk to it; nothing about it is deployed or operated by us.

### 11.2 Networking

- A single Docker Compose network (or two: `frontend` and `backend`) so that:
  - `web` is reachable from the host (published port, e.g. `80`/`443`).
  - `api` is reachable from `web` and the host (for local dev), but in a hardened deployment only `web`/reverse-proxy would be published — `api` stays internal.
  - `db` is **not** published to the host; only `api` can reach it.
  - `api` requires outbound HTTPS access to the payment processor's public endpoints.
- A reverse proxy (nginx/Traefik) container can front `web` + `api` under one origin to avoid CORS and to terminate TLS.

### 11.3 Configuration & Secrets

- All service configuration (DB connection string, JWT/session secret, payment processor base URL/API key, port numbers) is supplied via environment variables, not hardcoded.
- Local dev uses a `.env` file (excluded from version control via `.gitignore`); example values live in a committed `.env.example`.
- Database credentials and any signing secrets are treated as secrets — for Compose-based training use, env vars are acceptable; a real deployment would use Docker secrets or a secrets manager.

### 11.4 Data Persistence & Migrations

- `db` uses a named Docker volume so data survives container recreation (`docker compose down` without `-v`).
- Schema migrations run via the `migrate` one-shot service (or an entrypoint step on `api`) before `api` starts accepting traffic; Compose `depends_on` + a healthcheck on `db` gate startup order.

### 11.5 Images / Build

- Each Node service uses a **multi-stage Dockerfile**: a `build` stage with dev dependencies to compile/bundle, and a slim `runtime` stage (`node:XX-alpine`) that copies only production artifacts and `node_modules --omit=dev`.
- Containers run as a **non-root user** and do not run `npm install`/build steps at container start in production images.
- `.dockerignore` excludes `node_modules`, `.env`, and local build artifacts from the build context.

### 11.6 Representative `docker-compose.yml` shape

```yaml
services:
  web:
    build: ./web
    ports: ["8080:80"]
    depends_on: [api]

  api:
    build: ./api
    env_file: .env               # includes PAYMENT_PROCESSOR_BASE_URL / API key
    depends_on:
      db: { condition: service_healthy }
    expose: ["3000"]

  migrate:
    build: ./api
    command: ["npm", "run", "migrate"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: widgetshop
      POSTGRES_USER: widgetshop
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes: ["db_data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U widgetshop"]

volumes:
  db_data:
```

*(The payment processor is external and has no service entry here — `api` reaches it via `PAYMENT_PROCESSOR_BASE_URL` over the public internet.)*

### 11.7 Deployment-Related Requirements

1. The app must run end-to-end via a single `docker compose up` with no manual host setup beyond providing a `.env` (including payment processor credentials).
2. `db` must not be exposed on host-published ports.
3. No secret values are baked into images; all are injected at runtime via env vars/secrets.
4. Container images run as non-root and contain no dev-only tooling in the runtime stage.
5. `api` must not accept traffic until database migrations have completed successfully.
