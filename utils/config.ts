// Public build-time settings, read from .env / CI variables (see .env.example).

/** Off by default: the extension is free and makes no network calls. Set WXT_REQUIRE_LICENSE=true to sell it. */
export const REQUIRE_LICENSE = import.meta.env.WXT_REQUIRE_LICENSE === 'true';
export const LICENSE_API_URL = (import.meta.env.WXT_LICENSE_API_URL ?? 'https://licenses.example.com').replace(/\/$/, '');
export const PAYMENT_LINK_URL = import.meta.env.WXT_PAYMENT_LINK_URL ?? 'https://buy.stripe.com/your-link';
export const PRODUCT_ID = import.meta.env.WXT_PRODUCT_ID ?? 'uk-ipa';
