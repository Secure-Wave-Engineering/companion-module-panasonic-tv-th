const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')

const UpgradeScripts = require('./src/upgrades')

const configFields = require('./src/configFields')
const constants = require('./src/constants')
const api = require('./src/api')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

class PanasonicTVTHInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...configFields,
			...constants,
			...api,
			...actions,
			...feedbacks,
			...variables,
			...presets,
		})

		// Give each instance its own copy of the state object instead of sharing the one from constants
		this.DATA = { ...this.DATA }

		this.socket = undefined // TCP Socket connection
		this.established = false // The display has sent its banner on the current connection
		this.bannerTimer = undefined // Timeout waiting for the banner
		this.lastConnectError = 0 // Time of the last failed connection attempt
		this.retryTimer = undefined // Timer for the next connection attempt after a failure
		this.retryAt = 0 // When that timer fires
		this.timeoutCount = 0 // Consecutive commands the display did not answer

		this.INTERVAL = undefined // Polling Interval

		this.commandQueue = [] // Commands waiting to be sent
		this.pendingCommand = undefined // Command currently awaiting a response (new protocol)
		this.responseTimer = undefined // Timeout for the pending command
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config

		this.setProtocol()

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.initConnection()
		this.initPolling()

		this.checkFeedbacks()
		this.checkVariables()
	}

	async destroy() {
		if (this.INTERVAL !== undefined) {
			clearInterval(this.INTERVAL)
		}

		this.clearRetryTimer()
		this.resetCommandQueue()
		this.closeSocket()

		this.log('debug', 'destroy ' + this.id)
	}
}

runEntrypoint(PanasonicTVTHInstance, UpgradeScripts)
