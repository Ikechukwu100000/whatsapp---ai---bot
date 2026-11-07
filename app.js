// whatsapp-ai-bot - app.js - Pairing Code v2 (fixed timing)
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g, '');

app.get('/', (req, res) => res.send('WhatsApp AI Bot is running'));
app.listen(PORT, () => console.log('Server running on port ' + PORT));

let pairingRequested = false;

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    console.log('Connection:', connection);

    // Ask for pairing code ONLY when WhatsApp don connect small
    if (connection === 'connecting' && !sock.authState.creds.registered && !pairingRequested) {
      pairingRequested = true;
      if (!PHONE_NUMBER) {
        console.log('ERROR: Set PHONE_NUMBER in Render Environment Variables!');
        return;
      }
      console.log('Requesting pairing code for ' + PHONE_NUMBER + ' in 5 seconds...');
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('====================');
          console.log('PAIRING CODE: ' + code);
          console.log('====================');
          console.log('WhatsApp > Linked Devices > Link a device > Link with phone number > enter code');
        } catch (e) {
          console.log('Pairing code error:', e.message);
          pairingRequested = false; // allow retry on next reconnect
        }
      }, 5000);
    }

    if (connection === 'open') {
      console.log('Bot connected successfully!');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected, reconnecting:', shouldReconnect, 'code:', statusCode);
      if (shouldReconnect) {
        pairingRequested = false;
        setTimeout(() => startBot(), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!text) return;
    console.log('Message from', from, ':', text);
    let reply = '';
    const lower = text.toLowerCase();
    if (lower.includes('hi') || lower.includes('hello')) reply = 'Hello! I am your AI assistant. How can I help you today?';
    else if (lower.includes('who are you')) reply = 'I am an AI bot built with WhatsApp + Node.js, running on Render.';
    else if (lower.includes('help')) reply = 'Ask me anything. Try: hi, who are you, help';
    else reply = 'You said: "' + text + '". I understood you. What else do you want to know?';
    await sock.sendMessage(from, { text: reply });
  });
}

startBot();
