// Apply presentation-only branding without modifying the pinned upstream checkout.
module.exports = function (source) {
    if ((this.resourcePath.endsWith('menu-bar.jsx') || this.resourcePath.endsWith('stage-header.jsx'))) {
        return source.replace('alt="Scratch"', 'alt="Blocks Orbit"');
    }
    if (this.resourcePath.endsWith('titled-hoc.jsx')) {
        return source.replace("id: 'gui.gui.defaultProjectTitle'", "id: 'blocksOrbit.defaultProjectTitle'")
            .replace("defaultMessage: 'Scratch Project'", "defaultMessage: 'Blocks Orbit Project'");
    }
    return source;
};
