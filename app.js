const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const port = process.env.PORT || 8000;
const toRupiah = require('@develoka/angka-rupiah-js');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

var FormData = require('form-data');
var data = new FormData();
data.append('method', 'getInfo');
data.append('timestamp', '1578304294000');
data.append('recvWindow', '1578303937000');

var config = {
  method: 'post',
  url: 'https://indodax.com/tapi',
  headers: { 
    'Key': '16PAUVB9-DLLFQ7O6-NQJFR6FL-16PS8RV2-T5KDREP2', 
    'Sign': 'ec3674c67f0a2a9cfa6b63b2d531290d97f23d6048958a60fdf7c3a41e9b3df6019e23bf6f9e6db3e0b582ee383f18979837e1d4f4cc5488404886a5b7aa24ff', 
    'Cookie': '__cfduid=d56bed29e8266cbb7db94e808d28d398c1609741247; btcid=db560d0a61d9a8ed4c1e191aa1997ac8', 
    ...data.getHeaders()
  },
  data : data
};

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  session: sessionCfg
});

client.on('message', msg => {
  if (msg.body == '!ping') {
    msg.reply('pong');
  } else if (msg.body == 'good morning') {
    msg.reply('selamat pagi');
  } else if (msg.body == '!groups') {
    client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);

      if (groups.length == 0) {
        msg.reply('You have no group yet.');
      } else {
        let replyMsg = '*YOUR GROUPS*\n\n';
        groups.forEach((group, i) => {
          replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
        });
        replyMsg += '_You can use the group id to send a message to the group._'
        msg.reply(replyMsg);
      }
    });
  }else if(msg.body == 'Cek') {
    axios(config)
    .then(function (response) {
        var configs = {
            method: 'post',
            url: 'https://indodax.com/api/summaries',
            headers: { 
              'Cookie': '__cfduid=d56bed29e8266cbb7db94e808d28d398c1609741247; btcid=db560d0a61d9a8ed4c1e191aa1997ac8'
            }
          };
          
          axios(configs)
          .then(function (responses) {
            msg.reply(''
            +'ETH '+response.data.return.balance.eth+' = '+toRupiah((response.data.return.balance.eth*responses.data.tickers.eth_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.eth_idr.last)+'\n================================\n\n'
            +'Kur ETH '+(response.data.return.balance.eth-0.19581788)+' = '+toRupiah(((response.data.return.balance.eth-0.19581788)*responses.data.tickers.eth_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.eth_idr.last)+'\n================================\n\n'
            +'Nal ETH '+0.19581788+' = '+toRupiah((0.19581788*responses.data.tickers.eth_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.eth_idr.last)+'\n================================\n\n'
            +'ETC '+response.data.return.balance.etc+' = '+toRupiah((response.data.return.balance.etc*responses.data.tickers.etc_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.etc_idr.last)+'\n================================\n\n'
            +'WAVES '+response.data.return.balance.waves+' = '+toRupiah((response.data.return.balance.waves*responses.data.tickers.waves_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.waves_idr.last)+'\n================================\n\n'
            +'XRP '+response.data.return.balance.xrp+' = '+toRupiah((response.data.return.balance.xrp*responses.data.tickers.xrp_idr.last))+'\nHarga sekarang '+toRupiah(responses.data.tickers.xrp_idr.last)+'\n================================\n\n'
            );
          })
          .catch(function (error) {
            console.log(error);
          });
       
        // console.log(JSON.stringify());
    })
    .catch(function (error) {
    console.log(error);
    });

  }
});

client.initialize();

// Socket IO
io.on('connection', function(socket) {
  socket.emit('message', 'Connecting...');

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code received, scan please!');
    });
  });

  client.on('ready', () => {
    socket.emit('ready', 'Whatsapp is ready!');
    socket.emit('message', 'Whatsapp is ready!');
  });

  client.on('authenticated', (session) => {
    socket.emit('authenticated', 'Whatsapp is authenticated!');
    socket.emit('message', 'Whatsapp is authenticated!');
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
      if (err) {
        console.error(err);
      }
    });
  });

  client.on('auth_failure', function(session) {
    socket.emit('message', 'Auth failure, restarting...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp is disconnected!');
    fs.unlinkSync(SESSION_FILE_PATH, function(err) {
        if(err) return console.log(err);
        console.log('Session file deleted!');
    });
    client.destroy();
    client.initialize();
  });
});


const checkRegisteredNumber = async function(number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Send message
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send media
app.post('/send-media', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req.body.file;

  // const media = MessageMedia.fromFilePath('./image-example.png');
  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });

  const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send message to group
// -- Send message !groups to get all groups (id & name)
// -- So you can use that group id to send a message
app.post('/send-group-message', [
  body('id').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const chatId = req.body.id;
  const message = req.body.message;

  client.sendMessage(chatId, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

server.listen(port, function() {
  console.log('App running on *: ' + port);
});
