module.exports = {
	CHOICES_MODELS: [
		{ id: 'TH-84EF1U', label: 'TH-84EF1U', protocol: 'old' },
		{ id: 'TH-75EF1U', label: 'TH-75EF1U', protocol: 'old' },
		{ id: 'TH-85EF1W', label: 'TH-85EF1W', protocol: 'old' },
		{ id: 'TH-75EF1W', label: 'TH-75EF1W', protocol: 'old' },

		{ id: 'TH-98SQ2HW', label: 'TH-98SQ2HW', protocol: 'old' },
		{ id: 'TH-86EQ2W', label: 'TH-86EQ2W', protocol: 'old' },
		{ id: 'TH-86SQ2HW', label: 'TH-86SQ2HW', protocol: 'old' },
		{ id: 'TH-75EQ2W', label: 'TH-75EQ2W', protocol: 'old' },
		{ id: 'TH-75SQ2HW', label: 'TH-75SQ2HW', protocol: 'old' },
		{ id: 'TH-65EQ2W', label: 'TH-65EQ2W', protocol: 'old' },
		{ id: 'TH-65SQ2HW', label: 'TH-65SQ2HW', protocol: 'old' },
		{ id: 'TH-55EQ2W', label: 'TH-55EQ2W', protocol: 'old' },
		{ id: 'TH-55SQ2HW', label: 'TH-55SQ2HW', protocol: 'old' },
		{ id: 'TH-50EQ2W', label: 'TH-50EQ2W', protocol: 'old' },
		{ id: 'TH-50SQ2HW', label: 'TH-50SQ2HW', protocol: 'old' },
		{ id: 'TH-43EQ2W', label: 'TH-43EQ2W', protocol: 'old' },
		{ id: 'TH-43SQ2HW', label: 'TH-43SQ2HW', protocol: 'old' },

		{ id: 'TH-86CQ1W', label: 'TH-86CQ1W', protocol: 'old' },
		{ id: 'TH-75CQ1W', label: 'TH-75CQ1W', protocol: 'old' },
		{ id: 'TH-65CQ1W', label: 'TH-65CQ1W', protocol: 'old' },
		{ id: 'TH-55CQ1W', label: 'TH-55CQ1W', protocol: 'old' },
		{ id: 'TH-43CQ1W', label: 'TH-43CQ1W', protocol: 'old' },

		{ id: 'TH-49CQE1W', label: 'TH-49CQE1W', protocol: 'new' },
		{ id: 'TH-55EQ1', label: 'TH-55EQ1', protocol: 'new' },

		{ id: 'other', label: 'Other', protocol: undefined },
	],

	CHOICES_IMS: [
		{ id: 'HM1', label: 'HDMI 1' },
		{ id: 'HM2', label: 'HDMI 2' },
		{ id: 'PC1', label: 'PC' },
		{ id: 'UD1', label: 'USB' },
	],

	CHOICES_DAM: [
		{ id: 'FULL', label: 'Full' },
		{ id: 'NORM', label: 'Normal' },
		{ id: 'NATV', label: 'Native' },
		{ id: 'ZOOM', label: 'Zoom' },
	],

	CHOICES_AMT: [
		{ id: '0', label: 'Mute off' },
		{ id: '1', label: 'Mute on' },
	],

	DATA: {
		powerState: 0,
		powerLast: 0,
		volumeLast: 0,
		muteLast: 0,
		inputLast: '',
		viewmodeLast: '',
	},
}
