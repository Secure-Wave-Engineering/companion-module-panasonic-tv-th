# companion-module-panasonic-tv-th

See HELP.md and LICENSE

**v2.1.0**

- Power state polling now updates the `powerState` variable and feedback from the display's responses (new protocol)
- Support displays with protect mode off (`NTCONTROL 0`)
- Send commands one at a time so a slow display does not receive overlapping commands
- Fix power state feedback not being registered
- Displays that close the connection after each reply are reconnected silently instead of being reported as disconnected
- Add TH-55EQ1 to the model list and document which display protocol setting each model needs

**v2.0.0**

- Upgrade of module to new Companion API
- Modify for readability and maintainability
- Version bump from v0.0.3 to v2.0.0 for clarity that it is not a new module

**V0.0.1**

- Initial module
-
