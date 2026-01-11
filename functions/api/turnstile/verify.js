export async function onRequestPost({ request, env }) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "missing_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const secret = env.TURNSTILE_TRUCKING_SECRET_KEY;
    if (!secret) {
      return new Response(JSON.stringify({ ok: false, error: "missing_secret_env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);

    // Add the user's IP for better verification
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) formData.append("remoteip", ip);

    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();

    // Cloudflare returns: { success, "error-codes", ... }
    return new Response(
      JSON.stringify({
        ok: true,
        success: !!data.success,
        data,
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: data.success ? 200 : 400
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "exception", message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
