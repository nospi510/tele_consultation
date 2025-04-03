const express = require('express');
const { createServer } = require('http'); // Utilisation explicite de http
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');

// Configuration de l'application Express
const app = express();
const httpServer = createServer(app); // Crée un serveur HTTP explicite
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:8100', // Autorise le frontend Ionic
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

// Middleware pour gérer CORS manuellement si nécessaire
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8100');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Route de test pour vérifier que le serveur répond
app.get('/test', (req, res) => {
  res.send('Serveur mediasoup fonctionne');
});

httpServer.listen(3001, () => {
  console.log('Serveur mediasoup démarré sur http://localhost:3001');
});

let worker;
let router;
const mediasoupOptions = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  },
  router: {
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
    ],
  },
};

// Initialisation de mediasoup
(async () => {
  worker = await mediasoup.createWorker(mediasoupOptions.worker);
  router = await worker.createRouter(mediasoupOptions.router);
  console.log('Mediasoup worker et router initialisés');
})();

// Stockage des transports et producteurs
const transports = new Map();
const producers = new Map();
const consumers = new Map();

io.on('connection', (socket) => {
  console.log('Nouveau client connecté:', socket.id);

  socket.on('getRouterRtpCapabilities', async (data, callback) => {
    if (!router) {
      console.error('Router non initialisé');
      return callback({ error: 'Router non initialisé' });
    }
    console.log('Envoi des RtpCapabilities au client');
    callback(router.rtpCapabilities);
  });

  socket.on('createProducerTransport', async (data, callback) => {
    const { sessionId } = data;
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });
    transports.set(transport.id, transport);
    socket.join(sessionId);
    console.log('Transport producteur créé:', transport.id);
    callback({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on('connectProducerTransport', async (data, callback) => {
    const { transportId, dtlsParameters } = data;
    const transport = transports.get(transportId);
    if (!transport) {
      console.error('Transport non trouvé:', transportId);
      return callback({ error: 'Transport non trouvé' });
    }
    await transport.connect({ dtlsParameters });
    console.log('Transport producteur connecté:', transportId);
    callback();
  });

  socket.on('produce', async (data, callback) => {
    const { transportId, kind, rtpParameters, sessionId } = data;
    const transport = transports.get(transportId);
    if (!transport) {
      console.error('Transport non trouvé pour produire:', transportId);
      return callback({ error: 'Transport non trouvé' });
    }
    const producer = await transport.produce({ kind, rtpParameters });
    producers.set(producer.id, producer);
    console.log('Nouveau producteur créé:', producer.id, 'pour session:', sessionId);
    socket.to(sessionId).emit('newProducer', { producerId: producer.id, kind });
    callback({ id: producer.id });
  });

  socket.on('createConsumerTransport', async (data, callback) => {
    const { sessionId } = data;
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });
    transports.set(transport.id, transport);
    socket.join(sessionId);
    console.log('Transport consommateur créé:', transport.id);
    callback({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on('connectConsumerTransport', async (data, callback) => {
    const { transportId, dtlsParameters } = data;
    const transport = transports.get(transportId);
    if (!transport) {
      console.error('Transport non trouvé:', transportId);
      return callback({ error: 'Transport non trouvé' });
    }
    await transport.connect({ dtlsParameters });
    console.log('Transport consommateur connecté:', transportId);
    callback();
  });

  socket.on('consume', async (data, callback) => {
    const { transportId, producerId, rtpCapabilities } = data;
    const transport = transports.get(transportId);
    const producer = producers.get(producerId);

    if (!transport || !producer) {
      console.error('Transport ou producteur non trouvé:', { transportId, producerId });
      return callback({ error: 'Transport ou producteur non trouvé' });
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      console.error('Impossible de consommer le flux:', producerId);
      return callback({ error: 'Cannot consume' });
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });
    consumers.set(consumer.id, consumer);
    console.log('Consommateur créé:', consumer.id, 'pour producteur:', producerId);
    callback({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });

    await consumer.resume();
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
    transports.forEach((transport, id) => {
      if (!transport.closed) transport.close();
      transports.delete(id);
    });
    producers.forEach((producer, id) => {
      producer.close();
      producers.delete(id);
    });
    consumers.forEach((consumer, id) => {
      consumer.close();
      consumers.delete(id);
    });
  });
});