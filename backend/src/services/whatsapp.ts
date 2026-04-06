import axios from 'axios';
import { config } from '../config';
import { db } from '../db';
import { whatsappLog } from '../db/schema';

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.slice(1);
  }
  return cleaned;
}

async function callMetaApi(to: string, payload: any, logTemplate: string): Promise<boolean> {
  const url = `${GRAPH_API_URL}/${config.whatsapp.phoneId}/messages`;
  const headers = {
    Authorization: `Bearer ${config.whatsapp.token}`,
    'Content-Type': 'application/json',
  };

  const payloadJson = JSON.stringify(payload, null, 2);
  console.log(`📱 [WhatsApp] Sending ${logTemplate} to ${to}`);
  console.log(`📱 [WhatsApp] POST ${url}`);
  console.log(`📱 [WhatsApp] Body:\n${payloadJson}`);

  try {
    const response = await axios.post(url, payload, { headers, timeout: 15000 });

    const wamid = response.data?.messages?.[0]?.id || '';
    const msgStatus = response.data?.messages?.[0]?.message_status || '';
    console.log(`📱 [WhatsApp] ✓ HTTP ${response.status} — wamid: ${wamid}, status: ${msgStatus}`);

    try {
      await db.insert(whatsappLog).values({ phone: to, template: logTemplate, status: 'sent', wamid });
    } catch {}
    return true;
  } catch (err: any) {
    const errData = err.response?.data;
    const errMsg = errData?.error?.message || err.message;
    const errCode = errData?.error?.code || '';
    const errSubcode = errData?.error?.error_subcode || '';
    console.error(`📱 [WhatsApp] ✗ HTTP ${err.response?.status || 'timeout'}`);
    console.error(`📱 [WhatsApp] Error: [${errCode}/${errSubcode}] ${errMsg}`);
    if (errData) console.error(`📱 [WhatsApp] Full error: ${JSON.stringify(errData, null, 2)}`);

    try {
      await db.insert(whatsappLog).values({ phone: to, template: logTemplate, status: 'failed', error: `[${errCode}/${errSubcode}] ${errMsg}` });
    } catch {}
    return false;
  }
}

/**
 * Registration invite — single template message.
 *
 * WHATSAPP_TEMPLATE_PARAMS controls how many params are sent:
 *   2 → {{1}}=name, {{2}}=link           (e.g. survey_request_4)
 *   3 → {{1}}=name, {{2}}=org, {{3}}=link (e.g. keypass_invite)
 */
export async function sendRegistrationWhatsApp(
  phone: string,
  name: string,
  orgName: string,
  token: string
): Promise<boolean> {
  const to = normalizePhone(phone);
  const link = `${config.baseUrl}/open?token=${token}`;

  if (config.devMode) {
    console.log(`📱 [DEV] Registration → ${to} | name=${name} org=${orgName} link=${link}`);
    try { await db.insert(whatsappLog).values({ phone: to, template: 'registration', status: 'dev_logged' }); } catch {}
    return true;
  }

  const templateName = config.whatsapp.templateName;
  if (!templateName) {
    console.error('📱 [WhatsApp] WHATSAPP_TEMPLATE_NAME is not set — cannot send registration invite');
    try { await db.insert(whatsappLog).values({ phone: to, template: 'registration', status: 'failed', error: 'WHATSAPP_TEMPLATE_NAME not configured' }); } catch {}
    return false;
  }

  const paramCount = config.whatsapp.templateParamCount;
  let parameters: { type: string; text: string }[];

  if (paramCount === 2) {
    parameters = [
      { type: 'text', text: name || 'שלום' },
      { type: 'text', text: link },
    ];
  } else {
    parameters = [
      { type: 'text', text: name || 'שלום' },
      { type: 'text', text: orgName },
      { type: 'text', text: link },
    ];
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: config.whatsapp.templateLang },
      components: [
        { type: 'body', parameters },
      ],
    },
  };

  return callMetaApi(to, payload, `template:${templateName}`);
}

/**
 * OTP — plain text message within the 24h conversation window.
 */
export async function sendOtpWhatsApp(phone: string, otp: string): Promise<boolean> {
  const to = normalizePhone(phone);

  if (config.devMode) {
    console.log(`📱 [DEV] OTP → ${to} | code=${otp}`);
    try { await db.insert(whatsappLog).values({ phone: to, template: 'otp', status: 'dev_logged' }); } catch {}
    return true;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: `KeyPass — קוד אימות: ${otp}\nתוקף: 5 דקות.` },
  };

  return callMetaApi(to, payload, 'otp');
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
