export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "missing_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // IMPORTANT: this must match the exact Pages variable name
    const secret = env.TURNSTILE_TRUCKING_SECRET_KEY;

    // Safe debug (names only, no values)
    const envKeys = env ? Object.keys(env) : [];
    const turnstileKeys = envKeys.filter((k) => k.toUpperCase().includes("TURNSTILE"));

    const debugMeta = {
      secret_env_name: "TURNSTILE_TRUCKING_SECRET_KEY",
      secret_present: !!secret,
      secret_len: secret ? String(secret).length : 0,
      turnstile_env_keys_present: turnstileKeys,
    };

    console.log("turnstile.verify debugMeta:", debugMeta);

    if (!secret) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_secret_env",
          debugMeta,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);

    // Optional but recommended
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) formData.append("remoteip", ip);

    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();

    return new Response(
      JSON.stringify({
        ok: true,
        success: !!data.success,
        data,
        debugMeta: {
          ...debugMeta,
          // Keep it safe—still no secret
          verify_http_status: resp.status,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: data.success ? 200 : 400,
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "exception",
        message: String(e),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}