module.exports = (function () {
	'use strict';

	var assign = require('object-assign');
	var webpack = require('webpack');
	var pkg = require('../package.json');

	var banner = [
		pkg.name + ' - ' + pkg.description,
		'@version v' + pkg.version,
		'@link ' + pkg.homepage,
		'@license ' + pkg.license
	].join('\n');

	var common = {
		// entry: './src/entry.js',
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
		// resolve: {
		// 	modulesDirectories: ['web_modules', 'node_modules', 'bower_components']
		// },

		jshint: assign({
			failOnHint: true,
			emitErrors: true
		}, pkg.jshintConfig)
	};

	var exports = {};

	exports.dev = assign({}, common, {
		debug: true,
		devtool: 'eval', //sourcemap?
		output: {
			filename: 'dolly.js',
			pathInfo: true,
			libraryTarget: 'umd',
			library: 'Dolly'
		}
	});

	exports.production = assign({}, common, {
		devtool: 'source-map',
		output: {
			filename: 'dolly.js',
			sourceMapFilename: '[file].map',
			libraryTarget: 'umd',
			library: 'Dolly'
		},
		plugins: [
			new webpack.DefinePlugin({
				'process.env': {
					// This has effect on the react lib size
					'NODE_ENV': JSON.stringify('production')
				}
			}),
			new webpack.optimize.DedupePlugin(),
			new webpack.BannerPlugin(banner)
		]
	});

	exports.min = assign({}, common, {
		devtool: 'source-map',
		output: {
			filename: 'dolly.min.js',
			sourceMapFilename: '[file].map',
			libraryTarget: 'umd',
			library: 'Dolly'
		},
		plugins: [
			new webpack.DefinePlugin({
				'process.env': {
					// This has effect on the react lib size
					'NODE_ENV': JSON.stringify('production')
				}
			}),
			new webpack.optimize.DedupePlugin(),
			new webpack.optimize.UglifyJsPlugin({
				compress: {
					warnings: false
				},
			}),
			new webpack.BannerPlugin(banner)
		],
	});

	return exports;
}());