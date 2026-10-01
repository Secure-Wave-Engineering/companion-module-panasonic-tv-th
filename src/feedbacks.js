const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks() {
		let self = this
		const feedbacks = {}

		const foregroundColorWhite = combineRgb(255, 255, 255) // White
		const backgroundColorRed = combineRgb(255, 0, 0) // Red

		if (self.protocol === 'new') {
			feedbacks['powerState'] = {
				type: 'boolean',
				name: 'Show Power State On Button',
				description: 'Indicate if Display is On or Off',
				defaultStyle: {
					color: foregroundColorWhite,
					bgcolor: backgroundColorRed,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Indicate in X Status',
						id: 'state',
						default: false,
						choices: [
							{ id: false, label: 'Off' },
							{ id: true, label: 'On' },
						],
					},
				],
				callback: function (feedback) {
					let opt = feedback.options

					if (self.DATA.powerState == opt.state) {
						return true
					}

					return false
				},
			}
		} else {
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
