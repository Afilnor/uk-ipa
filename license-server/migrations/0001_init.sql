-- Customers are shared across products, so one buyer can own licenses for several extensions.
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE licenses (
  key TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  product_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  emailed_at TEXT,
  revoked_at TEXT
);

CREATE INDEX licenses_customer ON licenses(customer_id);
CREATE INDEX licenses_payment_intent ON licenses(stripe_payment_intent);
