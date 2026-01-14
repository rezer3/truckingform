export async function onRequest(context) {
  const cf = context.request.cf || {};
  const payload = {
    postalCode: typeof cf.postalCode === "string" ? cf.postalCode : null,
    regionCode: typeof cf.regionCode === "string" ? cf.regionCode : null,
    city: typeof cf.city === "string" ? cf.city : null,
    country: typeof cf.country === "string" ? cf.country : null,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}