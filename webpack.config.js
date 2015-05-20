module.exports = {
	entry: './src/index.js',
	devtool: 'eval',
	output: {
		path: __dirname + '/build',
		filename: 'index.js',
		libraryTarget: 'umd'
	},
	module: {
		preLoaders: [
			{
				test: /\.js$/,
				exclude: /node_modules|bower_components|src\/lib/,
				loader: 'jshint-loader'
			}
		],
		loaders: [
			{
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            }
		]
	},
	resolve: {
		modulesDirectories: ['web_modules', 'node_modules', 'bower_components']
	},

	//pretty strict
	jshint: {
		globals: {
			console: true
		},

		esnext: true,
		bitwise: true,
		browser: true,
		camelcase: true,
		curly: true,
		eqeqeq: true,
		es3: true,
		forin: true,
		freeze: true,
		funcscope: true,
		globalstrict: true,
		immed: true,
		iterator: true,
		latedef: true,
		maxparams: 4,
		newcap: true,
		noarg: true,
		nonbsp: true,
		nonew: true,
		notypeof: true,
		quotmark: 'single',
		shadow: true,
		//singleGroups: true,
		undef: true,
		//unused: true, todo: add this back in when more stuff is working

		failOnHint: true,
		emitErrors: true
	}

};