import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch } from '@kubernetes/client-node';
import { ConfigApi } from './api/ConfigApi';
import { VERSION } from './version';
import { Secrets } from './tools/Secrets';
import { ConfigMaps } from './tools/ConfigMaps';

// HTTP server for serving front, api and websockets
import WebSocket from 'ws';
import { StoreApi } from './api/StoreApi';
import { UserApi } from './api/UserApi';
import { KeyApi } from './api/KeyApi';
import { LoginApi } from './api/LoginApi';
const stream = require('stream');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser')
const PORT = 3883;

// Kubernetes API access
const kc = new KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(CoreV1Api);
const appsApi = kc.makeApiClient(AppsV1Api);
const k8sLog = new Log(kc);

var secrets:Secrets;
var configMaps:ConfigMaps;

const getMyNamespace = async () => {
  var podName=process.env.HOSTNAME;
  const pods = await coreApi.listPodForAllNamespaces();
  const pod = pods.body.items.find(p => p.metadata?.name === podName);
  if (pod && pod.metadata?.namespace) 
    return pod.metadata.namespace;
  else
    return 'default';
}

const sendLines = (ws:WebSocket, event:any, source:string) => {
  const logLines = source.split('\n');
  for (var l of logLines) {
    if (l!=='') {
      event.text=l;
      ws.send(JSON.stringify(event));    
    }
  }
}

// Get pod logs
const getPodLogs = async (namespace:string, podName:string, ws:any) => {
  try {
    const logStream = new stream.PassThrough();
    logStream.on('data', (chunk:any) => {
      var text=chunk.toString('utf8');
      var event={namespace:namespace, podName:podName}
      sendLines(ws,event,text);
    });
    await k8sLog.log(namespace, podName, '', logStream,  { follow: true, pretty: false });
  }
  catch (err:any) {
    console.error(err);
    ws.send(`Error: ${err.message}`);
  }
};


// watch deployment pods
const watchPods = (namespace:string, deploymentName:string, ws:any) => {
  const watch = new Watch(kc);

  watch.watch(
    `/api/v1/namespaces/${namespace}/pods`,
    { labelSelector: `app=${deploymentName}` },
    (type:string, obj:any) => {
      if (type === 'ADDED' || type === 'MODIFIED') {
        const podName = obj.metadata.name;
        console.log(`${type}: ${podName}` );
        getPodLogs(namespace, podName, ws);
      }
      else if (type === 'DELETED') {
        console.log(`${type}: ${deploymentName}` );
      }
    },
    (err:any) => {
      console.error(err);
      ws.send(`Error: ${err.message}`);
    }
  );
};

function processClientMessage(message:string, ws:any) {
  // {"namespace":"default","deploymentName":"ubuntu3"}
  const { namespace, deploymentName } = JSON.parse(message);
  watchPods(namespace, deploymentName, ws);
}

// HTTP server
const app = express();
app.use(bodyParser.json());
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws:any, req) => {
  var key=req.url?.replace('/?key=','');
  console.log('Client connected: '+key);

  ws.on('message', (message:string) => {
    processClientMessage(message, ws);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// serve front application
app.get('/', (req:any,res:any) => { res.redirect('/front') });
app.use('/front', express.static('./dist/front'))



const launch = (myNamespace:string) => {
  secrets = new Secrets(coreApi, myNamespace);
  configMaps = new ConfigMaps(coreApi, myNamespace);

  // serve config API
  var va:ConfigApi = new ConfigApi(kc, coreApi, appsApi);
  app.use(`/config`, va.route);
  var ka:KeyApi = new KeyApi(configMaps);
  app.use(`/key`, ka.route);
  var sa:StoreApi = new StoreApi(configMaps);
  app.use(`/store`, sa.route);
  var ua:UserApi = new UserApi(secrets);
  app.use(`/user`, ua.route);
  var la:UserApi = new LoginApi(secrets);
  app.use(`/login`, la.route);


  // listen
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Context being used: ${kc.currentContext}`);
    console.log(`Cluster name: ${kc.getCluster(kc.currentContext)?.name}`);
    console.log(`KWI1500I Control is being givent to KWirth`);
  });
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`KWirth version is ${VERSION}`);

getMyNamespace()
.then ( (namespace) => {
  console.log('Detected namespace: '+namespace);
  launch (namespace);
})
.catch ( (err) => {
  console.log('Cannot get namespace, using "default"');
  launch ('default');
});
