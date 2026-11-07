// whatsapp-ai-bot - app.js - Pairing Code version
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = process.env.PHONE_NUMBER || ''; // e.g. 2348012345678 - no +

app.get('/', (req, res) => {
  res.send('WhatsApp AI Bot is running');
});
app.listen(PORT, () => console.log('Server running on port ' + PORT));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing Code - only if not registered yet
  if (!sock.authState.creds.registered) {
    if (!PHONE_NUMBER) {
      console.log('ERROR: Set PHONE_NUMBER in Render Environment Variables!');
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('PAIRING CODE: ' + code);
          console.log('Go WhatsApp > Linked Devices > Link a device > Link with phone number > enter this code');
        } catch (e) {
          console.log('Pairing code error:', e.message);
        }
      }, 3000);
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    console.log('Connection:', connection);

    if (connection === 'open') {
      console.log('Bot connected successfully!');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected, reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
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
    if (lower.includes('hi') || lower.includes('hello')) {
      reply = 'Hello! I am your AI assistant. How can I help you today?';
    } else if (lower.includes('who are you')) {
      reply = 'I am an AI bot built with WhatsApp + Node.js, running on Render.';
    } else if (lower.includes('help')) {
      reply = 'Ask me anything. Try: hi, who are you, help';
    } else {
      reply = 'You said: "' + text + '". I understood you. What else do you want to know?';
    }

    await sock.sendMessage(from, { text: reply });
  });
}

startBot();
