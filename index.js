const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN ULTRA-LITE PARA SERVIDORES DE 1GB (GCP FREE TIER)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--single-process', // Ahorra mucha RAM en servers pequeños
            '--disable-extensions'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('----------------------------------------------------');
    console.log('🚨 NUEVO CÓDIGO QR 🚨');
    console.log('Entra a: http://34.28.206.25:3000/qr');
    const imagePath = __dirname + '/qr_code.png';
    await qrcode.toFile(imagePath, qr);
    console.log('----------------------------------------------------');
});

client.on('ready', () => {
    console.log('✅ El Bot está conectado y listo.');
});

app.get('/grupos', async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(g => ({
            name: g.name,
            id: g.id._serialized
        }));
        res.json({ totalGrupos: groups.length, grupos: groups });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los grupos' });
    }
});

app.post('/alerta', async (req, res) => {
    const { groupId, mensaje } = req.body;
    if (!groupId || !mensaje) return res.status(400).json({ error: 'Faltan parámetros' });

    try {
        // Enviar vía chat directo (más estable)
        const chat = await client.getChatById(groupId);
        await chat.sendMessage(mensaje);
        console.log(`🚨 Alerta enviada a: ${groupId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error enviando alerta:', error);
        res.status(500).json({ error: 'Error enviando alerta' });
    }
});

app.get('/qr', (req, res) => {
    res.sendFile(__dirname + '/qr_code.png');
});

app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
client.initialize();
app.listen(PORT, () => {
    console.log(`🌐 Servidor Lite corriendo en puerto ${PORT}`);
});
