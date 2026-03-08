const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

let sock;
const AUTH_DIR = 'auth_info_baileys';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Alerta Vecinal', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('----------------------------------------------------');
            console.log('🚨 NUEVO CÓDIGO QR 🚨');
            console.log('Entra a: http://34.28.206.25:3000/qr');
            const imagePath = __dirname + '/qr_code.png';
            await qrcode.toFile(imagePath, qr);
            console.log('----------------------------------------------------');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada debido a:', lastDisconnect.error, ', reconectando:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ El Bot (Baileys) está conectado y listo.');
            console.log('Para ver tus grupos, ve a: http://localhost:3000/grupos');
        }
    });
}

/**
 * RUTA 1: Obtener la lista de grupos
 */
app.get('/grupos', async (req, res) => {
    try {
        if (!sock) return res.status(500).json({ error: 'WhatsApp no inicializado' });

        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats).map(g => ({
            name: g.subject,
            id: g.id
        }));

        res.json({ totalGrupos: groups.length, grupos: groups });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los grupos' });
    }
});

/**
 * RUTA 2: Enviar alerta
 */
app.post('/alerta', async (req, res) => {
    const { groupId, mensaje } = req.body;

    if (!groupId || !mensaje) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    try {
        await sock.sendMessage(groupId, { text: mensaje });
        console.log(`🚨 Alerta enviada a: ${groupId}`);
        res.json({ success: true, mensaje: 'Alerta enviada' });
    } catch (error) {
        console.error('Error enviando alerta:', error);
        res.status(500).json({ error: 'Error enviando alerta' });
    }
});

/**
 * RUTA 3: QR Viewer
 */
app.get('/qr', (req, res) => {
    const imagePath = __dirname + '/qr_code.png';
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.send('QR no generado aún. Espera unos segundos...');
    }
});

app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor en puerto ${PORT}`);
    connectToWhatsApp();
});
