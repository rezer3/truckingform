export async function onRequestPost({ request, env }) {
  try {
    const { phone, link, turnstileToken, dryRun } = await request.json();

    const smsMode = String(env.SMS_MODE || "off").toLowerCase().trim(); // "on" | "off"
    const isDryRun = dryRun === true;

    // Validate phone number (10 digits)
    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number format. Expected 10 digits." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Basic "obviously fake" filters (cheap, reduces SMS waste)
    const allSameDigit = /^(\d)\1{9}$/.test(phone); // 0000000000, 1111111111, etc.
    const sequentialAsc = phone === "0123456789" || phone === "1234567890";
    const sequentialDesc = phone === "9876543210";
    if (allSameDigit || sequentialAsc || sequentialDesc) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Block NANP test / junk prefixes
    if (phone.startsWith("555")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate link
    if (!link || typeof link !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid link." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify Turnstile token first
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Turnstile verification." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the Turnstile token
    const verifyResp = await fetch(`${new URL(request.url).origin}/api/turnstile/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken }),
    });

const verifyData = await verifyResp.json();

if (!verifyData?.success) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Turnstile verification failed.",
      verifyData, // <-- includes error-codes from /api/turnstile/verify
      verifyStatus: verifyResp.status,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

    // Twilio creds required (Lookup uses SID+AUTH; we also require FROM for sending mode)
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "SMS service not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- Twilio Lookup v2: Line Type Intelligence (LTI) ----
    // Policy:
    // - mobile: ok
    // - landline: ok
    // - fixed_voip: ok
    // - anything else: block
    const lookupAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

    const lookupResp = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/+1${phone}?Fields=line_type_intelligence`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${lookupAuth}` },
      }
    );

    if (!lookupResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const lookupData = await lookupResp.json();
    const lineType = lookupData?.line_type_intelligence?.type;

    const allowed =
      lineType === "mobile" ||
      lineType === "landline" ||
      lineType === "fixed_voip";

    if (!allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Decide whether SMS should actually be sent
    const shouldSendSms =
      smsMode === "on" &&
      !isDryRun &&
      lineType === "mobile";

    // ---- If we are not sending SMS (off mode, dryRun, or non-mobile allowed types) ----
    if (!shouldSendSms) {
      return new Response(
        JSON.stringify({
          ok: true,
          sms: "skipped",
          lineType,
          smsMode,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // For SMS send path we require FROM number too
    if (!env.TWILIO_FROM_NUMBER) {
      return new Response(
        JSON.stringify({ ok: false, error: "SMS service not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- SMS path only for mobile, only when SMS_MODE=on, only when dryRun=false ----
    const body = new URLSearchParams();
    body.set("To", `+1${phone}`);
    body.set("From", env.TWILIO_FROM_NUMBER);
    body.set("Body", `Here is your trucking insurance quote link: ${link}`);

    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      console.error("Twilio error:", errorText);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to send SMS.", details: errorText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const twilioData = await resp.json();

    return new Response(
      JSON.stringify({
        ok: true,
        sms: "sent",
        lineType,
        smsMode,
        messageSid: twilioData.sid,
        status: twilioData.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Server error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Server error.", message: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}