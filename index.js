const express = require('express');
const { google } = require('googleapis');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Cargar credenciales de la variable de entorno
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

// Configurar autenticación con la cuenta de servicio
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Usa el ID correcto de tu hoja de cálculo:
const SPREADSHEET_ID = '1TXuK1ZzxYogGpenEIto1gSi5Fh1OJcR48XGg4VrbrOY';

// Webhook para verificación
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "chatbotecontrol";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Verificación exitosa');
    res.status(200).send(challenge);
  } else {
    console.log('Verificación fallida');
    res.sendStatus(403);
  }
});

// Endpoint para recibir mensajes (POST)
app.post('/webhook', async (req, res) => {
  console.log('Mensaje recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry?.changes && entry.changes[0];
    const value = changes?.value;

    if (value && value.messages && value.messages.length > 0) {
      const mensaje = value.messages[0].text?.body || '';
      const nombre = value.contacts[0].profile?.name || 'Sin nombre';
      const telefono = value.contacts[0].wa_id || 'Sin teléfono';

      // Append data to Google Sheets
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:C',
        valueInputOption: 'RAW',
        requestBody: {   // aquí debe usarse requestBody
          values: [
            [new Date().toISOString(), nombre, telefono, mensaje],
          ],
        },
      });

      res.status(200).send('EVENT_RECEIVED');
    } else {
      // Si no hay mensajes, responder OK para no volver a enviar el webhook
      res.status(200).send('NO_MESSAGE');
    }

  } catch (error) {
    console.error('Error al guardar en Sheets:', error);
    res.status(500).send('Error interno');
  }
});

app.listen(port, () => {
  console.log(`Servidor webhook escuchando en el puerto ${port}`);
});
