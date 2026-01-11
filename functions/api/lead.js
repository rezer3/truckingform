export async function onRequestPost({ request, env }) {
  // Env required:
  // - LEAD_WEBHOOK_URL (Text)
  // Optional:
  // - LEAD_WEBHOOK_SECRET (Secret) to sign payloads
  // - LEAD_WEBHOOK_TIMEOUT_MS (Text), e.g. "5000"

  if (!env.LEAD_WEBHOOK_URL) {
    return new Response(JSON.stringify({ ok: false, error: "missing_LEAD_WEBHOOK_URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await request.text(); // preserve exact body for signing
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- Phone verification backstop (server-side authority) ----
  // Rule:
  // - landline: allow (no SMS), but must have phone_verified === true
  // - fixed_voip: allow (no SMS), but must have phone_verified === true
  // - mobile: allow (SMS), but must have phone_verified === true
  // - anything else: should never reach here; reject
  //
  // This prevents bypassing /api/send-link by posting directly to /api/lead.
  if (payload?.phone && payload?.phone_verified !== true) {
    return new Response(JSON.stringify({ ok: false, error: "phone_verification_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const timeoutMs = Number(env.LEAD_WEBHOOK_TIMEOUT_MS || "5000");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  // Optional HMAC signature so your receiver can verify authenticity
  let signatureHex = null;
  if (env.LEAD_WEBHOOK_SECRET) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.LEAD_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    signatureHex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  try {
    const resp = await fetch(env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // REQUIRED: middleware ingest auth
        ...(env.LEAD_WEBHOOK_AUTH_BEARER ? { Authorization: `Bearer ${env.LEAD_WEBHOOK_AUTH_BEARER}` } : {}),

        ...(signatureHex ? { "X-Lead-Signature": signatureHex } : {}),
        "X-Lead-Source": "truckingform",
      },
      body: raw,
      signal: ac.signal,
    });

    const text = await resp.text();
    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        body: text.slice(0, 2000), // don’t reflect huge downstream responses
      }),
      { status: resp.ok ? 200 : 502, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "webhook_request_failed", details: String(e) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(t);
  }
}