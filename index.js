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

// ID de la hoja de cálculo (spreadsheet)
const SPREADSHEET_ID = '1AbCDeFGhIjKLmNOPqRSTuVWxyz1234567890';

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
    // Aquí debes extraer los datos que quieres guardar. Ejemplo simple:
    const mensaje = req.body.entry[0].changes[0].value.messages[0].text.body;
    const nombre = req.body.entry[0].changes[0].value.contacts[0].profile.name;
    const telefono = req.body.entry[0].changes[0].value.contacts[0].wa_id;
    
    // Agregar una fila nueva a la hoja de cálculo
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:C', // Cambia 'Sheet1' si tu hoja tiene otro nombre
      valueInputOption: 'RAW',
      resource: {
        values: [
          [new Date().toISOString(), nombre, telefono, mensaje],
        ],
      },
    });

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error al guardar en Sheets:', error);
    res.status(500).send('Error interno');
  }
});

app.listen(port, () => {
  console.log(`Servidor webhook escuchando en el puerto ${port}`);
});
