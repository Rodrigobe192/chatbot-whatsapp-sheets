const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Preguntas fijas (ordenadas)
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

// Índices de preguntas que tienen la opción "Otro"
const questionsWithOther = [2, 4];

// Estado en memoria para cada usuario (teléfono)
const userStates = {};

// Función para obtener la pregunta actual considerando si se está pidiendo especificar "Otro"
function getCurrentQuestion(userData) {
  // Si estamos en modo "especificar otro", la pregunta es para que escriba el detalle
  if (userData.expectingOtherDetail) {
    return "Por favor, especifique su opción:";
  }
  return questions[userData.step];
}

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
app.post('/webhook', (req, res) => {
  try {
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry?.changes && entry.changes[0];
    const value = changes?.value;

    if (value && value.messages && value.messages.length > 0) {
      const mensaje = value.messages[0].text?.body?.trim() || '';
      const telefono = value.contacts[0].wa_id;

      if (!userStates[telefono]) {
        // Nuevo usuario: iniciar en pregunta 0
        userStates[telefono] = {
          step: 0,
          answers: [],
          expectingOtherDetail: false,
        };
        console.log(`Iniciar conversación con ${telefono}`);
        console.log(`Enviar pregunta: ${questions[0]}`);
      } else {
        const userData = userStates[telefono];

        if (userData.expectingOtherDetail) {
          // Aquí el usuario está escribiendo la especificación para "Otro"
          userData.answers.push(mensaje); // guardamos la especificación
          userData.expectingOtherDetail = false;
          userData.step++; // pasamos a la siguiente pregunta
          
          if (userData.step < questions.length - 1) {
            console.log(`Respuesta especificada de ${telefono}: ${mensaje}`);
            console.log(`Enviar pregunta: ${questions[userData.step]}`);
          } else {
            console.log(`Última respuesta de ${telefono}: ${mensaje}`);
            console.log(`Fin de la conversación con respuestas:`, userData.answers);
            delete userStates[telefono];
          }

        } else {
          // Usuario responde normalmente
          userData.answers.push(mensaje);

          // Revisamos si la respuesta es "Otro" en preguntas que tienen esa opción
          if (questionsWithOther.includes(userData.step) && mensaje.toLowerCase() === 'otro') {
            userData.expectingOtherDetail = true;
            console.log(`Respuesta 'Otro' detectada para pregunta ${userData.step} de ${telefono}`);
            console.log(`Pedir especificación: Por favor, especifique su opción:`);
          } else {
            userData.step++;

            if (userData.step < questions.length - 1) {
              console.log(`Respuesta de ${telefono}: ${mensaje}`);
              console.log(`Enviar pregunta: ${questions[userData.step]}`);
            } else {
              console.log(`Última respuesta de ${telefono}: ${mensaje}`);
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
