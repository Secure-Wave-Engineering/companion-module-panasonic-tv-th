const { InstanceStatus, TCPHelper } = require('@companion-module/base')

let crypto = require('crypto')

// How long to wait for the display to answer a command before moving on to the next one
const RESPONSE_TIMEOUT = 2000

module.exports = {
	initConnection: function () {
		let self = this

		if (self.socket !== undefined) {
			self.socket.destroy()
			delete self.socket
		}

		if (self.socketTimer) {
			clearInterval(self.socketTimer)
			delete self.socketTimer
		}

		if (self.INTERVAL) {
			clearInterval(self.INTERVAL)
			delete self.INTERVAL
		}

		self.resetCommandQueue()

		self.updateStatus(InstanceStatus.Connecting)

		if (self.config.host && self.config.host !== '') {
			self.socket = new TCPHelper(self.config.host, self.config.port)

			self.socket.on('error', function (err) {
				self.updateStatus(InstanceStatus.ConnectionFailure, err.toString())
				self.log('error', 'Network Error: ' + err.message)
			})

			self.socket.on('connect', function () {
				self.updateStatus(InstanceStatus.Ok)

				// The display sends a new seed on every connection, so any old hash is invalid.
				// The first query is sent once the NTCONTROL/PDPCONTROL banner has been processed.
				self.hash = undefined
				self.resetCommandQueue()

				self.initPolling()
			})

			self.socket.on('data', function (d) {
				let data = String(d)

				if (self.config.verbose === true) {
					self.log('debug', 'Data received: ' + JSON.stringify(data))
				}

				// A chunk may contain several CR-terminated lines (e.g. the banner followed by a response)
				const lines = data
					.split(/\r\n|\r|\n/)
					.map((line) => line.trim())
					.filter((line) => line.length > 0)

				for (const line of lines) {
					self.processData(line)
				}
			})

			self.socket.on('end', function () {
				self.log('error', 'Display Disconnected')
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Display Disconnected')

				self.resetCommandQueue()

				if (self.INTERVAL) {
					//stop polling
					self.log('debug', 'Stopping Polling')
					clearInterval(self.INTERVAL)
					delete self.INTERVAL
				}

				// set timer to retry connection in 30 secs
				if (self.socketTimer) {
					clearInterval(self.socketTimer)
					delete self.socketTimer
				}

				self.log('debug', 'Setting timer to retry connection in 30 secs')

				self.socketTimer = setInterval(function () {
					self.updateStatus(InstanceStatus.Connecting)
					self.initConnection()
				}, 30000)
			})
		}
	},

	initPolling: function () {
		let self = this

		if (self.INTERVAL) {
			clearInterval(self.INTERVAL)
			delete self.INTERVAL
		}

		if (self.config.enablePolling && self.protocol === 'new') {
			let pollTime = parseInt(self.config.pollTime, 10)
			if (isNaN(pollTime) || pollTime < 250) {
				pollTime = 1000
			}

			if (self.config.verbose) {
				self.log('debug', `Initializing Polling every ${pollTime}ms`)
			}

			self.INTERVAL = setInterval(self.getData.bind(self), pollTime)
		}
	},

	getData: function () {
		let self = this

		self.checkPowerStatus() // get power status
	},

	checkPowerStatus: function () {
		let self = this

		if (self.protocol === 'new') {
			if (self.config.verbose) {
				self.log('debug', 'Checking power status...')
			}
			self.sendCommand('QPW')
		} else {
			// old protocol does not have a power status command
		}
	},

	processData: function (data) {
		let self = this

		if (data === 'Login:') {
			self.socket.send(self.config.user + '\r')
			if (self.config.verbose == true) {
				console.log('Response: ' + self.config.user)
			}
			return
		}

		if (data === 'Password:') {
			self.socket.send(self.config.pass + '\r')
			if (self.config.verbose == true) {
				console.log('Response: ' + self.config.pass)
			}
			return
		}

		if (data.match(/^NTCONTROL\s1\s\w+/)) {
			self.log('debug', 'New Command Structure Detected')
			let seed = data.split(' ')[2].trim()
			self.hash = crypto
				.createHash('md5')
				.update(self.config.user + ':' + self.config.pass + ':' + seed)
				.digest('hex')

			self.onBannerReceived()
			return
		}

		if (data.match(/^NTCONTROL\s0/)) {
			self.log('debug', 'New Command Structure Detected (protect mode off)')
			self.hash = ''

			self.onBannerReceived()
			return
		}

		if (data.match(/^PDPCONTROL\s1\s\w+/)) {
			self.log('debug', 'Protect Mode on, Generating Hash from seed and password from config')

			let seed = data.split(' ')[2].trim()
			self.hash = crypto
				.createHash('md5')
				.update(seed + self.config.pass)
				.digest('hex')

			self.log('debug', 'Seed: ' + seed)
			self.log('debug', 'Password: ' + self.config.pass)

			self.log('debug', 'Hash: ' + self.hash)

			self.onBannerReceived()
			return
		}

		if (data.match(/^PDPCONTROL\s0/)) {
			self.log('debug', 'Protect Mode off')
			self.hash = undefined

			self.onBannerReceived()
			return
		}

		self.handleResponse(data)
	},

	onBannerReceived: function () {
		let self = this

		// The display is ready to accept commands; send anything that was queued and query the initial state
		self.flushCommandQueue()
		self.getData()
	},

	handleResponse: function (line) {
		let self = this

		// The display does not echo the command it is answering, so use the command we are waiting on
		const command = self.pendingCommand

		if (line.startsWith('ERR')) {
			self.log('warn', `Display returned ${line}` + (command ? ` in response to ${command}` : ''))
			self.commandComplete()
			return
		}

		// Old protocol wraps responses in STX/ETX; new protocol prefixes them with '00'
		let payload = line.replace(/[\x02\x03]/g, '')
		if (payload.length > 3 && payload.startsWith('00')) {
			payload = payload.slice(2)
		}

		let powerState = undefined

		if (command === 'QPW') {
			if (payload === '001') {
				powerState = 1
			} else if (payload === '000') {
				powerState = 0
			} else {
				self.log('debug', `Unexpected response to QPW: ${line}`)
			}
		} else if (payload.indexOf('PON') !== -1) {
			powerState = 1
		} else if (payload.indexOf('POF') !== -1) {
			powerState = 0
		}

		if (powerState !== undefined && powerState !== self.DATA.powerState) {
			self.log('info', powerState ? 'TV is On' : 'TV is Off')
		}

		if (powerState !== undefined) {
			self.DATA.powerState = powerState
			self.checkVariables()
			self.checkFeedbacks('powerState')
		}

		self.commandComplete()
	},

	setProtocol: function () {
		let self = this

		let model = self.config.model

		//find model in CHOICES_MODELS to get protocol
		let modelObj = self.CHOICES_MODELS.find((m) => m.id === model)

		self.protocol = 'old' //default to old protocol

		if (modelObj === undefined) {
			//if model not found, default to old protocol
			self.protocol = 'old'
		} else if (model == 'other') {
			//if model is other, use protocolVersion selected in module config
			self.protocol = self.config.protocolVersion
		} else {
			self.protocol = modelObj.protocol
		}

		self.log('debug', 'Protocol set to: ' + self.protocol)
	},

	sendCommand: function (command, params) {
		let self = this
		let cmd = undefined

		if (command === undefined) {
			return
		}

		if (self.protocol === 'old') {
			cmd = ''
			if (self.hash !== undefined) {
				//if the hash is set, protect mode must be on
				cmd = self.hash
			}

			// old protocol
			cmd += '\x02' + command //STX
			if (params !== undefined) {
				cmd += ':' + params
			}
			cmd += '\x03' //ETX
			cmd += '\r' //CR

			self.writeToSocket(cmd)
		} else {
			// new protocol: the display answers without echoing the command, so only one command
			// may be in flight at a time. Queue it and send when the previous response has arrived.
			if (params !== undefined) {
				cmd = `00${command}:${params}\r`
			} else {
				cmd = `00${command}\r`
			}

			// Do not stack up polls if the display is slow to answer
			if (command === 'QPW' && (self.pendingCommand === 'QPW' || self.commandQueue.some((q) => q.command === 'QPW'))) {
				return
			}

			self.commandQueue.push({ command: command, cmd: cmd })
			self.flushCommandQueue()
		}
	},

	flushCommandQueue: function () {
		let self = this

		if (self.pendingCommand !== undefined || self.commandQueue.length === 0) {
			return
		}

		if (self.hash === undefined) {
			// Still waiting for the NTCONTROL banner, which provides the seed for the hash
			if (self.config.verbose) {
				self.log('debug', 'Waiting for display banner before sending commands')
			}
			return
		}

		if (!self.socket || !self.socket.isConnected) {
			self.log('debug', 'Socket not connected :(')
			self.commandQueue = []
			return
		}

		const next = self.commandQueue.shift()
		self.pendingCommand = next.command

		self.responseTimer = setTimeout(function () {
			if (self.config.verbose) {
				self.log('debug', `No response to ${self.pendingCommand} within ${RESPONSE_TIMEOUT}ms`)
			}
			self.commandComplete()
		}, RESPONSE_TIMEOUT)

		self.writeToSocket(self.hash + next.cmd)
	},

	commandComplete: function () {
		let self = this

		if (self.responseTimer) {
			clearTimeout(self.responseTimer)
			delete self.responseTimer
		}

		self.pendingCommand = undefined
		self.flushCommandQueue()
	},

	resetCommandQueue: function () {
		let self = this

		if (self.responseTimer) {
			clearTimeout(self.responseTimer)
			delete self.responseTimer
		}

		self.pendingCommand = undefined
		self.commandQueue = []
	},

	writeToSocket: function (cmd) {
		let self = this

		if (cmd && self.socket && self.socket.isConnected) {
			if (self.config.verbose) {
				self.log('debug', `Sending ${JSON.stringify(cmd)} to ${self.config.host}`)
			}

			const bufferCmd = Buffer.from(cmd)
			self.socket.send(bufferCmd).catch((err) => {
				self.log('error', 'Error sending command: ' + err.message)
			})
		} else {
			self.log('debug', 'Socket not connected :(')
		}
	},
}
