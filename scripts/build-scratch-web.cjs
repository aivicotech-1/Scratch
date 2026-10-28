const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';
process.env.CI = '1';
const webpack = require(path.join(root, 'scratch-editor/node_modules/webpack'));
process.chdir(path.join(root, 'scratch-editor/packages/scratch-gui'));
const config = require(path.join(process.cwd(), 'webpack.config.js'));
config.entry = {gui: config.entry.gui};
config.resolveLoader = {...config.resolveLoader, modules: ['node_modules', path.join(root, 'scratch-editor/node_modules')]};
config.output.path = path.join(root, 'web/dist');
config.output.clean = true;
if (process.env.NODE_ENV === 'production') config.devtool = false;
config.resolve.modules = [...(config.resolve.modules || ['node_modules']), path.join(root, 'scratch-editor/node_modules')];
config.plugins = config.plugins.filter(plugin =>
    plugin.constructor.name !== 'HtmlWebpackPlugin' || plugin.userOptions.chunks?.includes('gui'));
config.plugins.push(new webpack.NormalModuleReplacementPlugin(
    /^\.\/render-gui\.jsx$/, path.join(root, 'web/render-editor.js')));
// Replace only the GUI's block-container import; keep upstream sources untouched.
config.plugins.push(new webpack.NormalModuleReplacementPlugin(
    /^\.\.\/\.\.\/containers\/blocks\.jsx$/, resource => {
        if (resource.context === path.join(root, 'scratch-editor/packages/scratch-gui/src/components/gui')) {
            resource.request = path.join(root, 'web/python-workspace.js');
        }
    }
));
const fs = require('node:fs');
const HtmlWebpackPlugin = require(path.join(root, 'scratch-editor/node_modules/html-webpack-plugin'));
config.module.rules.push({
    test: /(?:menu-bar|stage-header|titled-hoc)\.jsx$/,
    include: path.join(root, 'scratch-editor/packages/scratch-gui/src'),
    enforce: 'pre',
    use: [{loader: path.join(root, 'scripts/orbit-branding-loader.cjs')}]
});
config.plugins.push(new webpack.NormalModuleReplacementPlugin(
    /(?:scratch-logo(?:-android)?|nineties_logo|cat_logo|prehistoric-logo|oldtimey-logo)\.svg$/,
    resource => {
        if ((resource.context.includes('menu-bar') || resource.context.includes('stage-header'))) resource.request = path.join(root, 'web/blocks-orbit-logo.svg');
    }
));
config.plugins.push({
    apply(compiler) {
        compiler.hooks.compilation.tap('BlocksOrbitBranding', compilation => {
            HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tap('BlocksOrbitBranding', data => {
                const favicon = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(root, 'web/orbit-icon.svg'), 'utf8'));
                data.html = data.html.replace(/<title>.*?<\/title>/, '<title>Blocks Orbit</title>')
                    .replace('href="static/favicon.ico"', 'href="' + favicon + '"');
                return data;
            });
        });
    }
});

webpack(config, (error, stats) => {
    if (error) { console.error(error); process.exitCode = 1; return; }
    console.log(stats.toString({all: false, errors: true, warnings: true, timings: true}));
    if (stats.hasErrors()) process.exitCode = 1;
});
