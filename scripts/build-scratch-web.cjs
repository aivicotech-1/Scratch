const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'development';
process.env.CI = '1';
const webpack = require(path.join(root, 'scratch-editor/node_modules/webpack'));
process.chdir(path.join(root, 'scratch-editor/packages/scratch-gui'));
const config = require(path.join(process.cwd(), 'webpack.config.js'));
config.entry = {gui: config.entry.gui};
config.output.path = path.join(root, 'web/dist');
config.resolve.modules = [...(config.resolve.modules || ['node_modules']), path.join(root, 'scratch-editor/node_modules')];
config.plugins = config.plugins.filter(plugin =>
    plugin.constructor.name !== 'HtmlWebpackPlugin' || plugin.userOptions.chunks?.includes('gui'));
config.plugins.push(new webpack.NormalModuleReplacementPlugin(
    /^\.\/render-gui\.jsx$/, path.join(root, 'web/render-editor.js')));
webpack(config, (error, stats) => {
    if (error) { console.error(error); process.exitCode = 1; return; }
    console.log(stats.toString({all: false, errors: true, warnings: true, timings: true}));
    if (stats.hasErrors()) process.exitCode = 1;
});
