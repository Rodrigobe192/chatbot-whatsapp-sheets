const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 🔐 Configuración - Reemplaza con tus valores
const TOKEN = 'EAAa9HR9WwQIBO0qtUpNBEzTRvZBtMBYPBZBSxXNwBiq7tt9KgAifYgZBV0BHvbtUFpcRDEZAg4fFXksYZByl8bM2g7DUWISjLeX7SZBAjdcjRRfNMmCsERcposWXnjvZB1osy2neBGKawiobFZCTTo3BGgJ74oE0wE7I2RAL7UrPqZBuSvbjYIbgnyR7Htxfl1yBrp3aTRI2ZBntZCxZCm0Ue6eikAiNd7IHg6KZCPJgZD';
const PHONE_NUMBER_ID = '720451244480251';
const VERIFY_TOKEN = 'chatbotecontrol';

// Preguntas del flujo conversacional
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

// Función para enviar mensajes de texto
async function sendMessage(to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`📤 Mensaje enviado a ${to}: ${message}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Función para enviar plantillas
async function sendTemplateMessage(to) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "econtrol_chatbot",
          language: { code: "es_PE" }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`📤 Plantilla enviada a ${to}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando plantilla:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Verificación del webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Fallo en verificación del webhook");
    res.sendStatus(403);
  }
});

// Manejo de mensajes entrantes
app.post('/webhook', async (req, res) => {
  console.log('📨 Evento recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    if (!req.body.object || !req.body.entry) {
      return res.status(200).send('EVENT_NOT_RECOGNIZED');
    }

    const entry = req.body.entry[0];
    const changes = entry.changes[0];
    
    if (changes.field !== 'messages') {
      return res.status(200).send('NOT_A_MESSAGE_EVENT');
    }

    const value = changes.value;
    
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const phoneNumber = message.from;
      const messageBody = message.text?.body || '';
      
      console.log(`📩 Mensaje de ${phoneNumber}: ${messageBody}`);

      if (!userStates[phoneNumber]) {
        // Nuevo usuario - Solo enviar plantilla inicial
        userStates[phoneNumber] = { 
          step: -2, // -2 = Plantilla enviada, esperando interacción
          answers: [],
          expectingOtherDetail: false,
          lastInteraction: new Date()
        };
        
        await sendTemplateMessage(phoneNumber);
        console.log(`👋 Plantilla inicial enviada a ${phoneNumber}`);
        return res.status(200).send('INITIAL_TEMPLATE_SENT');
      }

      const userData = userStates[phoneNumber];
      userData.lastInteraction = new Date();

      if (userData.step === -2) {
        // Usuario interactuó después de la plantilla - comenzar cuestionario
        userData.step = 0;
        await sendMessage(phoneNumber, questions[0]);
        console.log(`💬 Comenzando cuestionario con ${phoneNumber}`);
        return res.status(200).send('QUESTIONNAIRE_STARTED');
      }

      // Manejo normal del flujo de preguntas
      if (userData.expectingOtherDetail) {
        userData.answers.push(messageBody);
        userData.expectingOtherDetail = false;
        userData.step++;
      } else {
        userData.answers.push(messageBody);

        if (questionsWithOther.includes(userData.step) && messageBody.toLowerCase().startsWith('otro')) {
          userData.expectingOtherDetail = true;
          await sendMessage(phoneNumber, "Por favor, especifique su opción:");
          return res.status(200).send('EXPECTING_OTHER_DETAIL');
        }

        userData.step++;
      }

      // Continuar con siguiente pregunta o finalizar
      if (userData.step < questions.length) {
        await sendMessage(phoneNumber, questions[userData.step]);
      } else {
        await sendMessage(phoneNumber, questions[questions.length - 1]);
        console.log(`✅ Cuestionario completado con ${phoneNumber}`, userData.answers);
        delete userStates[phoneNumber];
      }
      
      res.status(200).send('EVENT_PROCESSED');
    } else {
      res.status(200).send('NO_MESSAGES_IN_EVENT');
    }
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(200).send('ERROR_PROCESSING');
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    usersActive: Object.keys(userStates).length
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
