const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const TOKEN = 'TU_TOKEN_DE_ACCESO_AQUI';

const questions = [
  "¡Buenos días! Bienvenido/a a Econtrol. Por favor, indique su nombre completo:",
  "¿En qué distrito se encuentra ubicado/a?",
  "Seleccione el tipo de local: Casa, Departamento/Edificio, Local Comercial, Local Industrial, Otro (especificar)",
  "Indique el rango de metros cuadrados: 0-50 m², 51-100 m², 101-200 m², Más de 200 m²",
  "Seleccione el servicio que necesita: Desinsectación Integral, Fumigación de mercaderías, Control y Monitoreo de Roedores, Desinfección de ambientes, Limpieza de Cisterna/Reservorios, Limpieza de Pozos Sépticos, Mantenimiento de Trampas de Grasa, Otro servicio (especificar)",
  "El servicio solicitado es: Preventivo (mantenimiento regular) o Correctivo (solución a problema existente)",
  "¿Desea que un asesor se comunique con usted para más información? (Sí, por favor / No, gracias)",
  "¡Gracias por su solicitud! Nos pondremos en contacto en el menor tiempo posible."
];

const questionsWithOther = [2, 4];
const userStates = {};

async function sendMessage(to, message) {
  try {
    await axios.post(`https://graph.facebook.com/v15.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      messaging_product: "whatsapp",
      to,
      text: { body: message }
    }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error.response?.data || error.message);
  }
}

app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry?.changes && entry.changes[0];
    const value = changes?.value;

    if (value && value.messages && value.messages.length > 0) {
      const mensaje = value.messages[0].text?.body?.trim() || '';
      const telefono = value.contacts[0].wa_id;

      if (!userStates[telefono]) {
        userStates[telefono] = { step: 0, answers: [], expectingOtherDetail: false };
        console.log(`Iniciar conversación con ${telefono}`);
        await sendMessage(telefono, questions[0]);
      } else {
        const userData = userStates[telefono];

        if (userData.expectingOtherDetail) {
          userData.answers.push(mensaje);
          userData.expectingOtherDetail = false;
          userData.step++;

          if (userData.step < questions.length - 1) {
            await sendMessage(telefono, questions[userData.step]);
          } else {
            await sendMessage(telefono, questions[questions.length - 1]);
            console.log(`Fin de la conversación con respuestas:`, userData.answers);
            delete userStates[telefono];
          }
        } else {
          userData.answers.push(mensaje);

          if (questionsWithOther.includes(userData.step) && mensaje.toLowerCase() === 'otro') {
            userData.expectingOtherDetail = true;
            await sendMessage(telefono, "Por favor, especifique su opción:");
          } else {
            userData.step++;

            if (userData.step < questions.length - 1) {
              await sendMessage(telefono, questions[userData.step]);
            } else {
              await sendMessage(telefono, questions[questions.length - 1]);
              console.log(`Fin de la conversación con respuestas:`, userData.answers);
              delete userStates[telefono];
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.status(200).send('NO_MESSAGE');
    }
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error interno');
  }
});

app.listen(port, () => {
  console.log(`Servidor webhook escuchando en el puerto ${port}`);
});
