const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: ['./web', './dist'],
    devMiddleware: {
      index: true,
      publicPath: './web',
      serverSideRender: true,
      writeToDisk: true,
    },
    watchFiles: ['src/**/*', 'web/**/*'],
  },
});
