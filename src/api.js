const { InstanceStatus, TCPHelper } = require('@companion-module/base')

let crypto = require('crypto')

// How long to wait for the display to answer a command before moving on to the next one
const RESPONSE_TIMEOUT = 2000
// After a failed connection attempt, wait this long before trying again
const RECONNECT_BACKOFF = 5000
// Never let more than this many commands pile up while the display is unreachable
const MAX_QUEUE_LENGTH = 20

module.exports = {
	initConnection: function () {
		let self = this

		self.closeSocket()
		self.resetCommandQueue()
		self.lastConnectError = 0

		if (self.config.host && self.config.host !== '') {
			self.updateStatus(InstanceStatus.Connecting)
			self.openSocket()
		} else {
			self.updateStatus(InstanceStatus.BadConfig, 'No host configured')
		}
	},

	// Some displays close the TCP connection after every reply, so the socket is
	// opened whenever there is something to send and quietly re-opened when the
	// display drops it.
	openSocket: function () {
		let self = this

		if (self.socket !== undefined) {
			if (self.socket.isConnected || self.socket.isConnecting) {
				return
			}
			self.closeSocket()
		}

		if (!self.config.host) {
			return
		}

		if (Date.now() - self.lastConnectError < RECONNECT_BACKOFF) {
			// The last attempt failed a moment ago, do not hammer the display
			return
		}

		if (self.config.verbose) {
			self.log('debug', `Connecting to ${self.config.host}:${self.config.port}`)
		}

		// Reconnection is handled here rather than by TCPHelper so a display that
		// hangs up after each reply does not get reported as a failure.
		const socket = new TCPHelper(self.config.host, self.config.port, { reconnect: false })
		self.socket = socket
		self.hash = undefined
		self.bannerReceived = false

		socket.on('error', function (err) {
			if (self.socket !== socket) return

			if (err.code === 'ECONNRESET' && self.bannerReceived) {
				// The display reset an established connection, treat it like a normal hang-up
				self.onSocketClosed('Display reset the connection')
				return
			}

			self.lastConnectError = Date.now()
			self.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			self.log('error', 'Network Error: ' + err.message)

			self.abortPendingCommand(false)
			self.commandQueue = []
			self.closeSocket()
		})

		socket.on('connect', function () {
			if (self.socket !== socket) return

			self.updateStatus(InstanceStatus.Ok)
			self.lastConnectError = 0
			// The display sends a fresh seed on every connection; commands are sent once the banner arrives
		})

		socket.on('data', function (d) {
			if (self.socket !== socket) return

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

		socket.on('end', function () {
			if (self.socket !== socket) return

			self.onSocketClosed('Display closed the connection')
		})
	},

	onSocketClosed: function (reason) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', reason)
		}

		// A command that was sent but never answered is retried on the next connection
		self.abortPendingCommand(true)
		self.closeSocket()

		if (self.commandQueue.length > 0) {
			// Something is waiting to be sent, reconnect straight away
			self.openSocket()
		}
	},

	closeSocket: function () {
		let self = this

		if (self.socket !== undefined) {
			self.socket.destroy()
			delete self.socket
		}

		self.hash = undefined
		self.bannerReceived = false
	},

	initPolling: function () {
		let self = this

		if (self.INTERVAL) {
			clearInterval(self.INTERVAL)
			delete self.INTERVAL
		}

		if (self.config.enablePolling && self.protocol === 'new' && self.config.host) {
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
			self.hash = ''

			self.onBannerReceived()
			return
		}

		self.handleResponse(data)
	},

	onBannerReceived: function () {
		let self = this

		self.bannerReceived = true

		// The display is ready to accept commands; send anything that was queued
		if (self.commandQueue.length === 0 && self.protocol === 'new') {
			// Nothing waiting (e.g. first connection), ask for the current state
			self.getData()
		} else {
			self.flushCommandQueue()
		}
	},

	handleResponse: function (line) {
		let self = this

		// The display does not echo the command it is answering, so use the command we are waiting on
		const command = self.pendingCommand ? self.pendingCommand.command : undefined

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
			// old protocol: STX + command [+ ':' + params] + ETX + CR, prefixed with the hash in protect mode
			cmd = '\x02' + command
			if (params !== undefined) {
				cmd += ':' + params
			}
			cmd += '\x03\r'
		} else {
			// new protocol: '00' + command [+ ':' + params] + CR, prefixed with the hash
			if (params !== undefined) {
				cmd = `00${command}:${params}\r`
			} else {
				cmd = `00${command}\r`
			}

			// Do not stack up polls if the display is slow to answer
			if (
				command === 'QPW' &&
				((self.pendingCommand && self.pendingCommand.command === 'QPW') ||
					self.commandQueue.some((q) => q.command === 'QPW'))
			) {
				// A poll is already waiting; give it a nudge in case the connection needs re-opening
				self.flushCommandQueue()
				return
			}
		}

		if (self.commandQueue.length >= MAX_QUEUE_LENGTH) {
			self.log('warn', `Command queue full, dropping oldest command (${self.commandQueue[0].command})`)
			self.commandQueue.shift()
		}

		self.commandQueue.push({ command: command, cmd: cmd, retries: 0 })
		self.flushCommandQueue()
	},

	flushCommandQueue: function () {
		let self = this

		if (self.commandQueue.length === 0) {
			return
		}

		if (!self.socket || !self.socket.isConnected) {
			// Commands are sent once the connection is up and the banner has been processed
			self.openSocket()
			return
		}

		if (self.hash === undefined) {
			// Still waiting for the banner, which provides the seed for the hash
			return
		}

		if (self.protocol === 'old') {
			// The old protocol has no queries to wait on, send everything straight away
			while (self.commandQueue.length > 0) {
				const next = self.commandQueue.shift()
				self.writeToSocket(self.hash + next.cmd)
			}
			return
		}

		// The new protocol's replies do not name the command they answer, so only
		// one command may be in flight at a time.
		if (self.pendingCommand !== undefined) {
			return
		}

		const next = self.commandQueue.shift()
		self.pendingCommand = next

		self.responseTimer = setTimeout(function () {
			if (self.config.verbose) {
				self.log('debug', `No response to ${next.command} within ${RESPONSE_TIMEOUT}ms`)
			}
			self.commandComplete()
		}, RESPONSE_TIMEOUT)

		self.writeToSocket(self.hash + next.cmd)
	},

	commandComplete: function () {
		let self = this

		self.abortPendingCommand(false)
		self.flushCommandQueue()
	},

	// Forget the command currently awaiting a reply. With retry set, a command that
	// was never answered goes back to the front of the queue for the next connection.
	abortPendingCommand: function (retry) {
		let self = this

		if (self.responseTimer) {
			clearTimeout(self.responseTimer)
			delete self.responseTimer
		}

		const pending = self.pendingCommand
		self.pendingCommand = undefined

		if (retry && pending && pending.retries < 1) {
			pending.retries++
			self.commandQueue.unshift(pending)
		}
	},

	resetCommandQueue: function () {
		let self = this

		self.abortPendingCommand(false)
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
