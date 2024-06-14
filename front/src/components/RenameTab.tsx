import React, { useState, useRef, ChangeEvent } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, Menu, MenuItem, MenuList, Select, SelectChangeEvent, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { LogObject } from '../model/LogObject';

interface IProps {
  onClose:(a:string|null) => {};
  tabs:LogObject[];
  oldname:string;
}
const RenameTab: React.FC<any> = (props:IProps) => {
  const [newname, setNewname] = useState(props.oldname);

  const onChangeNewname = (event:ChangeEvent<HTMLInputElement>) => {
      setNewname(event.target.value);
  }

  return (<>
    <Dialog open={true} disableRestoreFocus={true}>
      <DialogTitle>Set backup account</DialogTitle>
      <DialogContent>
      <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
        <Typography>Old name: {props.oldname}</Typography>
        <TextField value={newname} onChange={onChangeNewname} variant='standard'label='New name' autoFocus></TextField>
      </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose(newname)} disabled={props.tabs.some(t => t.tabname===newname)}>OK</Button>
        <Button onClick={() => props.onClose(null)}>CANCEL</Button>
      </DialogActions>
    </Dialog>
  </>);
};

export default RenameTab;