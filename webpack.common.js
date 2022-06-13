const path = require('path');

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
};
