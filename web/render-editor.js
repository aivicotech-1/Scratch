import '!style-loader!css-loader!./orbit.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppStateHOC from '../scratch-editor/packages/scratch-gui/src/lib/app-state-hoc.jsx';
import HashParserHOC from '../scratch-editor/packages/scratch-gui/src/lib/hash-parser-hoc.jsx';
import GUI from '../scratch-editor/packages/scratch-gui/src/containers/gui.jsx';
import {LegacyStorage} from '../scratch-editor/packages/scratch-gui/src/lib/legacy-storage';

const createConfig = () => {
    const storage = new LegacyStorage();
    storage.getLibraryAssetUrl = (id, format) =>
        window.location.origin + '/internalapi/asset/' + id + '.' + format + '/get/';
    return {storage};
};
const Editor = AppStateHOC(HashParserHOC(GUI), false, createConfig);
export default function renderEditor(target) {
    document.body.classList.add('blocks-orbit');
    document.title = 'Blocks Orbit';
    GUI.setAppElement(target);
    ReactDOM.createRoot(target).render(React.createElement(Editor, {
        canEditTitle: true,
        canCreateNew: false,
        canSave: false,
        canShare: false,
        canUseCloud: false,
        enableCommunity: false,
        backpackVisible: false,
        showComingSoon: false,
        username: '',
        assetHost: window.location.origin,
        projectHost: window.location.origin + '/projects'
    }));
}
