import React, {useEffect, useRef, useState} from 'react';
import {getMainWorkspace} from 'scratch-blocks';
import Blocks from '../scratch-editor/packages/scratch-gui/src/containers/blocks.jsx';
import {generatePython} from './python-generator.cjs';
import '!style-loader!css-loader!./python-workspace.css';

const h = React.createElement;
export default function PythonWorkspace(props) {
    const [mode, setMode] = useState('blocks');
    const [preview, setPreview] = useState({code: '', warnings: [], name: ''});
    const [copied, setCopied] = useState('');
    const wrapper = useRef(null);
    const blockPane = useRef(null);
    const copyTimer = useRef(null);
    useEffect(() => {
        if (mode === 'blocks' || !props.isVisible) return undefined;
        let timer;
        const update = () => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                try {
                    const vm = props.vm;
                    const originals = vm.runtime.targets.filter(t => t.isOriginal);
                    const index = originals.indexOf(vm.editingTarget);
                    setPreview(generatePython(JSON.parse(vm.toJSON()), index));
                } catch (_) {
                    setPreview({code: '# Python preview is unavailable for this project.\n',
                        warnings: ['This project could not be translated. Your blocks are unchanged.'], name: ''});
                }
            }, 120);
        };
        const events = ['PROJECT_CHANGED', 'PROJECT_LOADED', 'targetsUpdate', 'workspaceUpdate'];
        events.forEach(event => props.vm.on(event, update));
        update();
        return () => { clearTimeout(timer); events.forEach(event => props.vm.removeListener(event, update)); };
    }, [props.vm, mode, props.isVisible]);
    const fitBlocks = () => {
        const workspace = getMainWorkspace();
        if (!workspace || !blockPane.current?.offsetWidth || !workspace.getTopBlocks(false).length) return;
        const scale = workspace.scale;
        workspace.zoomToFit();
        // Fit without unexpectedly enlarging blocks the user already zoomed out.
        if (workspace.scale > scale) workspace.setScale(scale);
        workspace.scrollCenter();
    };
    useEffect(() => {
        const el = wrapper.current;
        let frame;
        const observer = new ResizeObserver(() => {
            window.dispatchEvent(new Event('resize'));
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (el.dataset.view === 'split') fitBlocks();
                const pane = blockPane.current;
                el.parentElement.parentElement.style.setProperty('--orbit-split-bottom',
                    Math.max(0, el.getBoundingClientRect().bottom - pane.getBoundingClientRect().bottom) + 'px');
            });
        });
        observer.observe(el);
        observer.observe(blockPane.current);
        return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, []);
    useEffect(() => () => clearTimeout(copyTimer.current), []);
    const switchMode = value => { setMode(value); setCopied(''); };
    const copy = async () => {
        try { await navigator.clipboard.writeText(preview.code); setCopied('Copied'); }
        catch (_) { setCopied('Select the code and copy it manually.'); }
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(''), 3000);
    };
    return h('div', {className: 'orbit-workspace', 'data-view': mode, ref: wrapper},
        h('div', {className: 'orbit-viewbar'},
            h('div', {className: 'orbit-view-buttons', role: 'group', 'aria-label': 'Editor view'},
                ...[['blocks', 'Blocks'], ['python', 'Python code'], ['split', 'Both']].map(([value, label]) =>
                    h('button', {key: value, type: 'button', 'aria-pressed': mode === value,
                        onClick: () => switchMode(value)}, label))),
            mode === 'split' && h('button', {type: 'button', onClick: fitBlocks, title: 'Fit your scripts in the visible workspace'}, 'Fit blocks'),
            h('span', {className: 'orbit-view-hint'}, mode === 'blocks' ? 'Build with blocks' : 'Live Python preview')),
        h('div', {className: 'orbit-workspace-panes'},
            h('div', {className: 'orbit-block-pane', ref: blockPane, hidden: mode === 'python'},
                h(Blocks, {...props, isVisible: props.isVisible && mode !== 'python'})),
            mode !== 'blocks' && h('section', {className: 'orbit-python-pane', 'aria-label': 'Python code preview'},
                h('div', {className: 'orbit-python-heading'},
                    h('strong', null, preview.name || 'Python'),
                    h('button', {type: 'button', onClick: copy, disabled: !preview.code}, 'Copy code')),
                h('p', {className: 'orbit-python-note'},
                    'Read-only learning view. Change blocks to update Python. The illustrated orbit API is not a runnable Python engine.'),
                preview.warnings.length > 0 && h('details', {className: 'orbit-python-warnings'},
                    h('summary', null, preview.warnings.length + ' translation notice(s)'),
                    h('ul', null, ...preview.warnings.map(w => h('li', {key: w}, w)))),
                h('pre', {tabIndex: 0, 'aria-label': 'Generated Python code'},
                    h('code', null, ...preview.code.split('\n').map((line, index) =>
                        h('span', {className: 'orbit-python-line' + (line.trim().startsWith('#') ? ' orbit-python-comment' : ''),
                            key: index}, h('span', {className: 'orbit-line-number', 'aria-hidden': true}, index + 1), line, '\n')))),
                h('span', {className: 'orbit-copy-status', role: 'status'}, copied)))
    );
}
