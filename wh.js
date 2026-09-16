const url = "https://api.telegram.org/bot8732006531:AAHCi9z19vQpEY2KPb4kcl2scdDtbuMXzHg";
const r = await fetch(url + "/getWebhookInfo");
const j = await r.json();
console.log(JSON.stringify({
  has_custom_certificate: j.result?.has_custom_certificate,
  url: j.result?.url,
  pending_update_count: j.result?.pending_update_count,
  last_error_date: j.result?.last_error_date,
  last_error_message: j.result?.last_error_message,
  ip_address: j.result?.ip_address,
}, null, 1));