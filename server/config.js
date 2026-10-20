'use strict';
const path = require('path');

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const DEV = process.env.DEV === '1';

function detectPublicUrl() {
  const e = process.env;
  let u = e.PUBLIC_URL || e.WEBAPP_URL || e.RENDER_EXTERNAL_URL || '';
  if (!u && e.RAILWAY_PUBLIC_DOMAIN) u = 'https://' + e.RAILWAY_PUBLIC_DOMAIN;
  if (!u && e.KOYEB_PUBLIC_DOMAIN) u = 'https://' + e.KOYEB_PUBLIC_DOMAIN;
  if (!u && e.FLY_APP_NAME) u = 'https://' + e.FLY_APP_NAME + '.fly.dev';
  return u.replace(/\/+$/, '');
}

let channel = (process.env.CHANNEL || '@ukademiklar').trim();
if (!channel.startsWith('@') && !/^-?\d+$/.test(channel)) channel = '@' + channel;

module.exports = {
  BOT_TOKEN,
  DEV,
  PORT: Number(process.env.PORT) || 3000,
  PUBLIC_URL: detectPublicUrl(),
  CHANNEL: channel,
  CHANNEL_LINK: channel.startsWith('@') ? 'https://t.me/' + channel.slice(1) : '',
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(/[,\s]+/).filter(Boolean).map(Number),
  TZ_OFFSET_MIN: 5 * 60, // Asia/Tashkent (UTC+5, yozgi vaqt yo'q)
  IS_RENDER: !!process.env.RENDER,
};
