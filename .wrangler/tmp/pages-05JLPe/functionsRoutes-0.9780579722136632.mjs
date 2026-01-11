import { onRequestPost as __api_turnstile_verify_js_onRequestPost } from "/Users/ramonrootharam/cf/truckingform/functions/api/turnstile/verify.js"
import { onRequestGet as __api_config_js_onRequestGet } from "/Users/ramonrootharam/cf/truckingform/functions/api/config.js"
import { onRequestPost as __api_lead_js_onRequestPost } from "/Users/ramonrootharam/cf/truckingform/functions/api/lead.js"
import { onRequestPost as __api_send_link_js_onRequestPost } from "/Users/ramonrootharam/cf/truckingform/functions/api/send-link.js"

export const routes = [
    {
      routePath: "/api/turnstile/verify",
      mountPath: "/api/turnstile",
      method: "POST",
      middlewares: [],
      modules: [__api_turnstile_verify_js_onRequestPost],
    },
  {
      routePath: "/api/config",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_config_js_onRequestGet],
    },
  {
      routePath: "/api/lead",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_lead_js_onRequestPost],
    },
  {
      routePath: "/api/send-link",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_send_link_js_onRequestPost],
    },
  ]