export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      smsMode: (env.SMS_MODE || "off").toLowerCase(),
      turnstilesiteKey: env.TURNSTILE_TRUCKING_SITE_KEY || "",
    }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
}
