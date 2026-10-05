## Panasonic TV TH-Series

This module will connect to a Panasonic TV TH series, such as the TH-86CQ1W, TH-75CQ1W, TH-65CQ1W, TH-55CQ1W, TH-50CQ1, TH-43CQ1W, TH-49CQE1W and TH-55EQ1 models.

**Display protocol setting**

The display's network settings offer a choice of command protocol. It must match the protocol the module uses for the selected model:

- Old-protocol models (CQ1, EQ2, SQ2 and EF1 series): set the display to "Protocol 1".
- New-protocol models (TH-49CQE1W, TH-55EQ1): set the display to "Protocol 2". On these displays "Protocol 1" accepts commands but does not report the power state.

If your model is not listed, select "Other" and choose the protocol version manually.

Older displays may not support authentication correctly, so if you are having issues, disable protect mode/authentication on the display.

**Available Commands**

- Power On
- Power Off
- Set Volume
- Mute
- Input Select
- View Mode

**Available Feedbacks**

- Power State

New models (such as the TH-49CQE1W and TH-55EQ1), require an updated communication protocol, if using one of these new models you will also get the power status reported as a variable.

**Power State Polling (new protocol only)**

When "Enable Polling" is checked, the module queries the display's power state (`QPW`) at the configured polling interval and updates the `powerState` variable (`On`/`Off`) and the "Show Power State On Button" feedback from the response. Commands are sent one at a time, so a slow display will not receive overlapping commands.

Some displays close the network connection after every reply. The module handles this automatically: the connection is re-opened whenever there is something to send, and this is not reported as an error. The connection status only turns red when the display cannot be reached, or stops answering commands.
