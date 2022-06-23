const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/ts/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      stream: require.resolve('stream-browserify'), // and install `stream-browserify`
      buffer: false, // require.resolve("buffer/") and install `buffer`
    },
  },
  output: {
    filename: './bitmovin-player-yospace.js',
    path: path.join(__dirname, 'dist/js'),
    libraryTarget: 'umd',
    library: {
      amd: 'BitmovinYospacePlayer',
      commonjs: 'BitmovinYospacePlayer',
      root: ['bitmovin', 'player', 'ads', 'yospace'],
    },
  },
  target: ['web', 'es5'],
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
};
