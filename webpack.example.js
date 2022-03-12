const Path = require('path');
const Webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

const source = Path.resolve(__dirname, "./example");
const output = Path.resolve(__dirname, "./build");

module.exports = {
	entry: ['./example/main.js'],
	output: {
		filename: '[name].bundle.js',
		path: output
	},
	devServer: {
		contentBase: source,
		hot: true
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{
					from: Path.resolve(__dirname, "./assets"),
					to: Path.resolve(__dirname, output + "/assets"),
					force: true
				}
			],
			options: {concurrency: 100}
		}),
		new HtmlWebpackPlugin({
			filename: './example/index.html',
			template: './example/index.html'
		}),
		new Webpack.NamedModulesPlugin(),
		new Webpack.HotModuleReplacementPlugin()
	],
	module: {
		rules: [
			{
				test: /\.glsl$/i,
				use: "raw-loader"
			}
		]
	}
};
