import { useState, useRef, ChangeEvent, useEffect } from 'react';

// material & icons
import { AppBar, Box, Button, Drawer, IconButton, Stack, Tab, Tabs, TextField, Toolbar, Tooltip, Typography } from '@mui/material';
import { Settings, Info, ArrowUpward, ArrowDownward, Clear, Menu, Person } from '@mui/icons-material';

// model
import { User } from './model/User';
import { Alert } from './model/Alert';
import { LogObject } from './model/LogObject';
import { Cluster } from './model/Cluster';

// tools
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack';
import { Beep } from './tools/Beep';
import { PickListConfig } from './model/PickListConfig';
import { PopupConfig } from './model/PopupConfig';

// components
import BlockingAlert from './components/BlockingAlert';
import AlertConfig from './components/AlertConfig';
import RenameLog from './components/RenameLog';
import SaveConfig from './components/SaveConfig';
import ManageApiSecurity from './components/ManageApiSecurity';
import PickList from './components/PickList';
import Popup from './components/Popup';
import Login from './components/Login';
import ManageClusters from './components/ManageClusters';
import ManageUserSecurity from './components/ManageUserSecurity';
import Selector from './components/ResourceSelector';
import MenuLog from './menus/MenuLog';
import LogContent from './components/LogContent';
import MenuDrawer from './menus/MenuDrawer';


const App: React.FC = () => {
  var backend='http://localhost:3883';
  if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host;

  const [user, setUser] = useState<User>();
  const [logged,setLogged]=useState(false);
  const [apiKey,setApiKey]=useState('');

  //navigation
  const [drawerOpen,setDrawerOpen]=useState(false);
  
  //+++ move picklist objects to a helper class
  const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null);
  var pickListConfigRef=useRef(pickListConfig);
  pickListConfigRef.current=pickListConfig;

  //+++ move popup objects to a helper class
  const [popupConfig, setPopupConfig] = useState<PopupConfig|null>(null);
  var popupConfigRef=useRef(popupConfig);
  popupConfigRef.current=popupConfig;

  const [clusters, setClusters] = useState<Cluster[]>();
  const clustersRef = useRef(clusters);
  clustersRef.current=clusters;

  const [logs, setLogs] = useState<LogObject[]>([]);
  const [highlightedLogs, setHighlightedLogs] = useState<LogObject[]>([]);
  const [pausedLogs, setPausedLogs] = useState<LogObject[]>([]);

  const [selectedLogName, setSelectedLogName] = useState<string>();
  const selectedLogRef = useRef(selectedLogName);
  selectedLogRef.current=selectedLogName;
  var selectedLog = logs.find(t => t.name===selectedLogName);
  var selectedLogIndex = logs.findIndex(t => t.name===selectedLogName);

  // message list management
  const [messages, setMessages] = useState<string[]>([]);
  const searchLineRef = useRef(null);
  const lastLineRef = useRef(null);

  // search & filter
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchPos, setSearchPos] = useState<number>(0);
  const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
  const [searchLastPos, setSearchLastPos] = useState<number>(-1);

  // menus
  const [anchorMenuLog, setAnchorMenuLog] = useState<null | HTMLElement>(null);

  // components
  const [showAlertConfig, setShowAlertConfig]=useState<boolean>(false);
  const [showBlockingAlert, setShowBlockingAlert]=useState<boolean>(false);
  const [showRenameLog, setShowRenameLog]=useState<boolean>(false);
  const [showManageClusters, setShowManageClusters]=useState<boolean>(false);
  const [showSaveConfig, setShowSaveConfig]=useState<boolean>(false);
  const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false);
  const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false);
  const [blockingAlert, setBlockingAlert] = useState<Alert>();
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);
  const [configName, setConfigName] = useState('');
  const [showPickList, setShowPickList]=useState<boolean>(false);
  const [showPopup, setShowPopup]=useState<boolean>(false);

  useEffect ( () => {
    //+++ implement admin role (enabling/disabling menu options)
    //+++ implement role checking on backend
    //+++ when a config view is loaded all messages are received: alarms should not be in effect until everything is received
    //+++ with ephemeral logs, content of 'messages' should be some info on alarms triggered, or even a dashboard
    //+++ plan to use kubernetes metrics for alarming based on resource usage (basic kubernetes metrics on pods and nodes)
    //+++ add navigation to tabs (to allow lots of tabs that will no fit into the browser)
    //+++ decide wheter to hav collapsibility on teh resource selector (to maximize log space)
    if (logged && !clustersRef.current) getClusters();
  });

  useEffect ( () => {
    if (logged) {
      setConfigLoaded(false);
      if (logs.length>0) {
        for (var t of logs)
          startLog(t);
        onChangeLogs(null, logs[0].name);
      }
    }
  }, [configLoaded]);

  const getClusters = async () => {
    // get current cluster
    var response = await fetch(`${backend}/config/cluster`, { headers:{Auhtorization:apiKey}});
    var srcCluster = await response.json() as Cluster;
    srcCluster.url=backend;
    srcCluster.source=true;
    srcCluster.apiKey=apiKey;

    // get previously configured clusters
    var clusterList:Cluster[]=[];
    var response = await fetch (`${backend}/store/${user?.id}/clusters/list`, { headers:{Auhtorization:apiKey}});
    if (response.status===200) {
      clusterList=JSON.parse (await response.json());
      clusterList=clusterList.filter (c => c.name!==srcCluster.name);
    }
    clusterList.push(srcCluster);
    fetch (`${backend}/store/${user?.id}/clusters/list`, {method:'POST', body:JSON.stringify(clusterList), headers:{'Content-Type':'application/json'}});
    setClusters(clusterList);
  }

  const onResourceSelectorAdd = (selection:any) => {
    var logName=selection.namespace+"-"+selection.resource;
    if (selection.resource==='') logName=logName.substring(0,logName.length-1);
    if (selection.scope==='cluster') logName='cluster';

    // create unduplicated (unique) name
    var index=-1;
    while (logs.find (l => l.name===logName+index)) index-=1;

    var newLog:LogObject= new LogObject();
    newLog.cluster=selection.clusterName;
    newLog.scope=selection.scope;
    newLog.namespace=selection.namespace;
    newLog.obj=selection.resource;
    newLog.name=logName+index;

    logs.push(newLog);
    setMessages(['Use log menu (settings button on tab) to start log reciever...']);
    setLogs(logs);
    setSelectedLogName(newLog.name);
    setFilter('');
    setSearch('');
  };

  const onChangeLogs = (event:any,value:string)=> {
    var newlog = logs.find(log => log.name === value);
    if (newlog) {
      newlog.pending=false;
      setHighlightedLogs (highlightedLogs.filter(t => t.pending));
      setPausedLogs (pausedLogs.filter(log => log.paused));
      setFilter(newlog.filter);
      setMessages(newlog.messages);
      setLogs(logs);
    }
    setSelectedLogName(value);
  }

  // process an event received via websocket
  const processEvent = (event:any) => {
    // find the log who this web socket belongs to, and add the new message
    var log=logs.find(log => log.ws!==null && log.ws===event.target);
    if (!log) return;
    
    var msg:any={};
    try {
      msg=JSON.parse(event.data);
    }
    catch (err) {
      console.log(err);
      console.log(event.data);
    }

    var text=msg.text;
    if (log.scope==='namespace' || log.scope==='cluster' ) text=msg.podName+'  '+text;

    if (log) {
      if (msg.timestamp) text=msg.timestamp.replace('T',' ').replace('Z','') + ' ' + text;
      log.messages.push(text);

      // if current log is displayed (focused), add message to the screen
      if (selectedLogRef.current === log.name) {
        if (!log.paused) {
          //setMessages((prev) => [...prev, text ]);
          setMessages((prev) => log!.messages);
          if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }
      else {
        // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
        if (log.showBackgroundNotification && !log.paused) {
          log.pending=true;
          setHighlightedLogs((prev)=> [...prev, log!]);
          setLogs(logs);
        }
      }
    }
    else {
      console.log('log not found');
      return;
    }

    // review alerts
    if (log) {
      for (var alert of log.alerts) {
        if (text.includes(alert.expression)) {
          if (alert.beep) {
            Beep.beepError();
          }
          
          if (alert.type==='blocking') {
            setBlockingAlert(alert);
            setShowBlockingAlert(true);
          }
          else {
            // in the view action, implement scrollinto view for showing the message that caused the received alert
            const action = (snackbarId: SnackbarKey | undefined) => (
              <>
                <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log?.name); }}>
                  View
                </Button>
                <Button onClick={() => { closeSnackbar(snackbarId) }}>
                  Dismiss
                </Button>
              </>
            );
            var opts:any={
              anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
              variant:alert.severity,
              autoHideDuration:(alert.type==='timed'? 3000:null),
              action: action
            };
            enqueueSnackbar(alert.message, opts);
          }
        }
      }
    }
  }

  const startLog = (log:LogObject) => {
    log.messages=[];
    var cluster=clusters!.find(c => c.name===log.cluster);
    if (!cluster) {
      console.log('nocluster');
      return;
    }
    var ws = new WebSocket(cluster.url+'?key='+cluster.apiKey);
    log.ws=ws;
    ws.onopen = () => {
      console.log(`Connected to the WebSocket: ${ws.url}`);
      var payload={ scope:log?.scope, namespace:log?.namespace, deploymentName:log?.obj, timestamp:log?.addTimestamp};
      if (log) {
        ws.send(JSON.stringify(payload));
        log.started=true;
      }
      else {
        console.log('no loobject');
      }
    };
    
    ws.onmessage = (event) => processEvent(event);

    ws.onclose = (event) => {
      console.log(`Disconnected from the WebSocket: ${ws.url}`);
    };

    setMessages([]);
  }

  const onClickLogStart = () => {
    var log=logs.find(l => l.name===selectedLogRef.current);
    if (log) startLog(log);
    setAnchorMenuLog(null);
  }

  const stopLog = (log:LogObject) => {
    var endline='====================================================================================================';
    log.messages.push(endline);
    log.started=false;
    log.paused=false;
    setPausedLogs(logs.filter(t => t.paused));
    setMessages((prev) => [...prev,endline]);
    if (!log) {
      console.log('nto');
    }
    log.ws?.close();
  }

  const onClickLogStop = () => {    
    if (selectedLog) stopLog(selectedLog);
    setAnchorMenuLog(null);
  }

  const onClickLogRemove = () => {
    if (selectedLog) {
      onClickLogStop();
      if (logs.length===1)
        setMessages([]);
      else
        onChangeLogs(null,logs[0].name);
      setLogs(logs.filter(t => t!==selectedLog));
    }
    setAnchorMenuLog(null);
  }

  const onClickLogPauseResume = () => {
    if (selectedLog) {
      if (selectedLog.paused) {
        selectedLog.paused=false;
        setMessages(selectedLog.messages);
        setPausedLogs(logs.filter(t => t.paused));
        setLogs(logs);
      }
      else {
        selectedLog.paused=true;
        setPausedLogs( (prev) => [...prev, selectedLog!]);
        setLogs(logs);
      }
    }
    setAnchorMenuLog(null);
  }

  const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value);
    if (selectedLog) selectedLog.filter=event.target.value;
  }

  const menuLogOptionSelected = (option: string) => {
    //+++ convert literals to enumeration
    switch(option) {
      case 'ml':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex-1];
          logs[selectedLogIndex-1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'mr':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex+1];
          logs[selectedLogIndex+1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'ms':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.splice(0, 0, selectedLog);
          setLogs(logs);
        }
        break;  
      case 'me':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.push(selectedLog);
          setLogs(logs);
        }
        break;
      case 'bn':
        if (selectedLog) selectedLog.showBackgroundNotification=!selectedLog.showBackgroundNotification;
        break;
      case 'ts':
        if (selectedLog) selectedLog.addTimestamp=!selectedLog.addTimestamp;
        break;
      case 'fa':
        setShowAlertConfig(true);
        break;
      case 'rl':
        setShowRenameLog(true);
        break;
      case 'dl':
        if (selectedLog) selectedLog.default=true;
        break;
      case 'ls':
        onClickLogStart();
        break;
      case 'lpr':
        onClickLogPauseResume();
        break;
      case 'lstop':
        onClickLogStop();
        break;
      case 'lr':
        onClickLogRemove();
        break;
      case 'manrestart':
        switch(selectedLog?.scope) {
          case 'cluster':
            break;
          case 'namespace':
            break;
          case 'deployment':
            fetch (`${backend}/manage/${selectedLog.namespace}/${selectedLog.obj}`, {method:'POST', body:'', headers:{'Content-Type':'application/json'}});
            break;
        }
        break;
    }
    setAnchorMenuLog(null);
  };

  const saveConfig = (cfgName:string) => {
    var newlos:LogObject[]=[];
    for (var lo of logs) {
      var newlo = new LogObject();
      newlo.addTimestamp=lo.addTimestamp;
      newlo.alerts=lo.alerts;
      newlo.cluster=lo.cluster;
      newlo.filter=lo.filter;
      newlo.namespace=lo.namespace;
      newlo.obj=lo.obj;
      newlo.default=lo.default;
      newlo.paused=lo.paused;
      newlo.scope=lo.scope;
      newlo.showBackgroundNotification=lo.showBackgroundNotification;
      newlo.started=lo.started;
      newlo.name=lo.name;
      newlos.push(newlo);
    }
    var payload=JSON.stringify(newlos);
    fetch (`${backend}/store/${user?.id}/configviews/${cfgName}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    if (configName!==cfgName) setConfigName(cfgName);
  }

  const showNoConfigs = () => {
    popup('Config management...',<Stack direction={'row'} alignItems={'center'}><Info  color='info' fontSize='large'/>&nbsp;You have no config stored in your personal Kwirth space</Stack>,true, false, false, false, false, false);
  }

  const loadConfig = async () => {
    var allConfigs:string[] = await (await fetch (`${backend}/store/${user?.id}/configviews`)).json();
    if (allConfigs.length===0)
      showNoConfigs();
    else
      pickList('Load config...','Please, select the config you want to load:',allConfigs,loadConfigSelected);
  }

  var clearLogs = () => {
    for (var t of logs)
      stopLog(t);
    setLogs([]);
    setMessages([]);
  }

  const menuConfigOptionSelected = async (option: string) => {
    setDrawerOpen(false);
    switch(option) {
      case 'new':
        clearLogs();
        setConfigName('untitled');
        break;
      case 'save':
        if (configName!=='' && configName!=='untitled')
          saveConfig(configName);
        else
          setShowSaveConfig(true);
        break;
      case 'saveas':
        setShowSaveConfig(true);
        break;
      case 'open':
        loadConfig();
        break;
      case 'delete':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user?.id}/configviews`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else
          pickList('Config delete...','Please, select the config you want to delete:',allConfigs,deleteConfigSelected);
        break;
      case 'mc':
        setShowManageClusters(true);
        break;
      case 'asec':
        setShowApiSecurity(true);
        break;
      case 'usec':
        setShowUserSecurity(true);
        break;
      case 'cfgexp':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user?.id}/configviews`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else {
          var content:any={};
          for (var cfgName of allConfigs) {
            var readCfg = await (await fetch (`${backend}/store/${user?.id}/configviews/${cfgName}`)).json();
            content[cfgName]=JSON.parse(readCfg);
          }
          handleDownload(JSON.stringify(content),`${user?.id}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`);
        }
        break;
      case 'cfgimp':
        // nothing to do, the menuitem launches the handleUpload
        break;
      case 'exit':
        setLogged(false);
        break;
    }
  };

  const handleDownload = (content:string,filename:string,  mimeType:string='text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const handleUpload = (event:any) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e:any) => {
          var allConfigs=JSON.parse(e.target.result);
          for (var cfgName of Object.keys(allConfigs)) {
            var payload=JSON.stringify(allConfigs[cfgName]);
            fetch (`${backend}/store/${user?.id}/configviews/${cfgName}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
          }
        };
        reader.readAsText(file);
    }
  }

  const alertConfigClosed= (alert:Alert) => {
    setShowAlertConfig(false);
    if (alert.expression) {
        var alert=new Alert();
        alert.expression=alert.expression;
        alert.severity=alert.severity;
        alert.message=alert.message;
        alert.type=alert.type;
        alert.beep=alert.beep;
        selectedLog?.alerts.push(alert);
      }
  }

  const renameLogClosed= (newname:string|null) => {
    setShowRenameLog(false);
    if (newname!=null) {
      selectedLog!.name=newname;
      setLogs(logs);
      //+++ set focus to recently renamed tab
    }
  }

  const saveConfigClosed = (newname:string|null) => {
    setShowSaveConfig(false);
    if (newname!=null) saveConfig(newname);
  }

  const loadConfigSelected = async (cfgName:string) => {
    if (cfgName) {
      clearLogs();
      var n = await (await fetch (`${backend}/store/${user?.id}/configviews/${cfgName}`)).json();
      var newlos=JSON.parse(n) as LogObject[];
      setLogs(newlos);
      setConfigLoaded(true);
      setConfigName(cfgName);
      //+++ move log focus the the log which has a 'default:true' in its properties
    }
  }

  const deleteConfigSelected = (cfgName:string) => {
    if (cfgName) fetch (`${backend}/store/${user?.id}/configviews/${cfgName}`, {method:'DELETE'});
  }

  const pickList = (title:string, message:string, values:string[], onClose:(a:string) => void ) =>{
    var plc:PickListConfig=new PickListConfig();
    plc.title=title;
    plc.message=message;
    plc.values=values;
    plc.originOnClose=onClose;
    plc.onClose=pickListClosed;
    setPickListConfig(plc);
    setShowPickList(true);
  }

  //+++ create convenient yes-no dialogs
  const popup = (title:string, message:JSX.Element, ok:boolean, yes:boolean, yestoall:boolean, no:boolean, notoall:boolean, cancel:boolean, onClose:(a:string) => void = () => {} ) =>{
    var pc:PopupConfig=new PopupConfig();
    pc.title=title;
    pc.message=message;
    pc.ok=ok;
    pc.yes=yes;
    pc.yestoall=yestoall;
    pc.no=no;
    pc.notoall=notoall;
    pc.cancel=cancel;
    pc.originOnClose=onClose;
    pc.onClose=popupClosed;
    setPopupConfig(pc);
    setShowPopup(true);
  }

  const pickListClosed = (a:string|null) => {
    setShowPickList(false);
    if (a!==null) pickListConfigRef?.current?.originOnClose(a);
    setPickListConfig(null);
  }

  const popupClosed = (a:string|null) => {
    setShowPopup(false);
    if (a!==null) popupConfigRef?.current?.originOnClose(a);
    setPopupConfig(null);
  }

  const manageClustersClosed = (cc:Cluster[]) => {
    setShowManageClusters(false);
    fetch (`${backend}/store/${user?.id}/clusters/list`, {method:'POST', body:JSON.stringify(cc), headers:{'Content-Type':'application/json'}});
    setClusters(cc);
  }

  const onCloseLogin = (result:boolean, user:User) => {
    if (result) {
      setLogged(true); 
      setUser(user);
      setApiKey(apiKey);
      setConfigName('untitled');
      clearLogs();
    }
  }

  useEffect ( () => {
    if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [search]);

  if (!logged) return (<>
    <div style={{ backgroundImage:`url('/front/turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
      <Login onClose={onCloseLogin} backend={backend}></Login>
    </div>
  </>);

  const onChangeSearch = (event:ChangeEvent<HTMLInputElement>) => {
    var newsearch=event.target.value;
    setSearch(newsearch);
    if (newsearch!=='') {
      var pos=selectedLog!.messages.findIndex(m => m.includes(newsearch));
      setSearchFirstPos(pos);
      setSearchLastPos(selectedLog!.messages.findLastIndex(m => m.includes(newsearch)));
      setSearchPos(pos);
      if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const onClickSearchDown = () => {
    var pos=messages!.findIndex( (msg,index) => msg.includes(search) && index>searchPos);
    if (pos>=0) {
      setSearchPos(pos);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const onClickSearchUp = () => {
    var pos=messages!.findLastIndex( (msg,index) => msg.includes(search) && index<searchPos);
    if (pos>=0) {
      setSearchPos(pos);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (<>
    <div>
      <AppBar position="sticky" elevation={0} sx={{ zIndex: 99, height:'64px' }}>
        <Toolbar>
          <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }} onClick={() => setDrawerOpen(true)}>
              <Menu />
          </IconButton>
          <Typography sx={{ ml:1,flexGrow: 1 }}>
            KWirth
          </Typography>
          <Typography variant="h6" component="div" sx={{mr:2}}>
              {configName}
          </Typography>
          <Tooltip title={<div style={{textAlign:'center'}}>{user?.id}<br/>{user?.name}</div>} sx={{ mr:2 }}>
              <Person/>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer sx={{  flexShrink: 0,  '& .MuiDrawer-paper': { mt: '64px' }  }} anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <MenuDrawer optionSelected={menuConfigOptionSelected} uploadSelected={handleUpload} user={user}/>
      </Drawer>

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
          <Selector clusters={clusters} onAdd={onResourceSelectorAdd} sx={{ mt:1, ml:3, mr:3 }}/>

          <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>
            { (logs.length>0) && <>
                <Stack direction="row" sx={{ ml:1}} alignItems="bottom" >
                  <TextField value={filter} onChange={onChangeFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard"/>
                  <TextField value={search} onChange={onChangeSearch} InputProps={{ endAdornment: <IconButton onClick={()=>setSearch('')}><Clear fontSize='small'/></IconButton> }} sx={{ml:1}} label="Search" variant="standard" />
                  <Typography sx={{ ml:1 }}></Typography>
                  <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
                  <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton>
                </Stack>
            </>}
            
            <Tabs value={selectedLogName} onChange={onChangeLogs}>
              { logs.length>0 && logs.map(t => {
                  if (t.scope==='cluster')
                    return <Tab key={t.name} label='cluster' value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                  else {
                    if (t===selectedLog)
                      return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                    else
                      return <Tab key={t.name} label={t.name} value={t.name} icon={<Settings fontSize='small'/>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                  }
                })
              }
            </Tabs>
          </Stack>

        { anchorMenuLog && <MenuLog onClose={() => setAnchorMenuLog(null)} optionSelected={menuLogOptionSelected} anchorMenuLog={anchorMenuLog} logs={logs} selectedLog={selectedLog} selectedLogIndex={selectedLogIndex} />}
        <LogContent messages={messages} filter={filter} search={search} searchPos={searchPos} searchLineRef={searchLineRef} lastLineRef={lastLineRef}/>
      </Box>

      { showAlertConfig && <AlertConfig onClose={alertConfigClosed} expression={filter}/> }
      { showBlockingAlert && <BlockingAlert onClose={() => setShowBlockingAlert(false)} alert={blockingAlert} /> }
      { showRenameLog && <RenameLog onClose={renameLogClosed} logs={logs} oldname={selectedLog?.name}/> }
      { showSaveConfig && <SaveConfig onClose={saveConfigClosed} name={configName} /> }
      { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
      { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} backend={backend}/> }
      { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} backend={backend}/> }
      { pickListConfig!==null && <PickList config={pickListConfig}/> }
      { popupConfig!==null && <Popup config={popupConfig}/> }    
    </div>
  </>);
};

export default App;