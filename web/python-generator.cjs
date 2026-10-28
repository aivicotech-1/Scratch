// Read-only teaching translation. The illustrative orbit API is not a Python runtime.
const quote = value => JSON.stringify(String(value ?? '')).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const literal = value => typeof value === 'boolean' ? (value ? 'True' : 'False') :
    typeof value === 'number' && Number.isFinite(value) ? String(value) :
        Array.isArray(value) ? '[' + value.map(literal).join(', ') + ']' : quote(value);
const parseArray = value => { try { return JSON.parse(value || '[]'); } catch (_) { return []; } };

function generatePython(project, targetIndex = 0) {
    const target = project.targets?.[targetIndex];
    if (!target) return {code: '# Select a sprite or the stage to see its Python.\n', warnings: [], name: ''};
    const blocks = target.blocks || {};
    const warnings = new Set();
    const stage = project.targets.find(t => t.isStage) || target;
    const procedures = new Map();
    let activeArgs = new Map();
    const tops = Object.entries(blocks).filter(([, b]) => b && !Array.isArray(b) && b.topLevel && !b.shadow)
        .sort((a, b) => (a[1].y || 0) - (b[1].y || 0) || (a[1].x || 0) - (b[1].x || 0));
    const field = (b, key) => b.fields?.[key]?.[0] ?? '';
    const ref = (b, key) => {
        const [name, id] = b.fields?.[key] || ['', ''];
        const global = Object.prototype.hasOwnProperty.call(stage.variables || {}, id) ||
            Object.prototype.hasOwnProperty.call(stage.lists || {}, id);
        return (global ? 'stage' : 'sprite') + (key === 'LIST' ? '.lists[' : '.variables[') + quote(name) + ']';
    };
    for (const [, b] of tops) {
        if (b.opcode === 'procedures_definition') {
            const proto = blocks[b.inputs?.custom_block?.[1]];
            if (proto?.mutation) {
                const m = proto.mutation;
                procedures.set(m.proccode, {name: 'custom_block_' + (procedures.size + 1),
                    ids: parseArray(m.argumentids), names: parseArray(m.argumentnames), warp: m.warp === 'true'});
            }
        }
    }
    const missing = opcode => {
        warnings.add('No Python translation yet: ' + opcode);
        return 'orbit.unsupported(' + quote(opcode) + ')';
    };
    const primitive = p => {
        if (!Array.isArray(p)) return literal(p ?? '');
        if (p[0] === 12 || p[0] === 13) return ref({fields: {[p[0] === 12 ? 'VARIABLE' : 'LIST']: [p[1], p[2]]}}, p[0] === 12 ? 'VARIABLE' : 'LIST');
        if (p[0] >= 4 && p[0] <= 8 && String(p[1]).trim() !== '' && Number.isFinite(Number(p[1]))) return String(Number(p[1]));
        return literal(p[1]);
    };
    const input = (b, key, seen = new Set()) => {
        const v = b.inputs?.[key]?.[1];
        if (v == null) return key === 'CONDITION' || key.startsWith('OPERAND') ? 'False' : '0';
        return typeof v === 'string' ? expression(v, seen) : primitive(v);
    };
    const expression = (id, seen = new Set()) => {
        if (seen.has(id)) { warnings.add('Circular block reference'); return 'None'; }
        const nextSeen = new Set(seen); nextSeen.add(id);
        const b = blocks[id];
        if (Array.isArray(b)) return primitive(b);
        if (!b) return 'None';
        const i = key => input(b, key, nextSeen), f = key => quote(field(b, key));
        const binary = {operator_add: '+', operator_subtract: '-', operator_multiply: '*'};
        if (binary[b.opcode]) return '(orbit.number(' + i('NUM1') + ') ' + binary[b.opcode] + ' orbit.number(' + i('NUM2') + '))';
        const compares = {operator_lt: 'less_than', operator_gt: 'greater_than', operator_equals: 'equals'};
        if (compares[b.opcode]) return 'orbit.' + compares[b.opcode] + '(' + i('OPERAND1') + ', ' + i('OPERAND2') + ')';
        const expr = {
            operator_divide: () => 'orbit.divide(' + i('NUM1') + ', ' + i('NUM2') + ')',
            operator_mod: () => 'orbit.mod(' + i('NUM1') + ', ' + i('NUM2') + ')',
            operator_and: () => '(orbit.truth(' + i('OPERAND1') + ') and orbit.truth(' + i('OPERAND2') + '))',
            operator_or: () => '(orbit.truth(' + i('OPERAND1') + ') or orbit.truth(' + i('OPERAND2') + '))',
            operator_not: () => '(not orbit.truth(' + i('OPERAND') + '))',
            operator_random: () => 'orbit.random(' + i('FROM') + ', ' + i('TO') + ')',
            operator_join: () => '(orbit.text(' + i('STRING1') + ') + orbit.text(' + i('STRING2') + '))',
            operator_letter_of: () => 'orbit.letter(' + i('LETTER') + ', ' + i('STRING') + ')',
            operator_length: () => 'len(orbit.text(' + i('STRING') + '))',
            operator_contains: () => 'orbit.contains(' + i('STRING1') + ', ' + i('STRING2') + ')',
            operator_round: () => 'orbit.round(' + i('NUM') + ')',
            operator_mathop: () => 'orbit.math(' + f('OPERATOR') + ', ' + i('NUM') + ')',
            data_variable: () => ref(b, 'VARIABLE'), data_listcontents: () => 'orbit.list_text(' + ref(b, 'LIST') + ')',
            data_itemoflist: () => 'orbit.list_item(' + ref(b, 'LIST') + ', ' + i('INDEX') + ')',
            data_itemnumoflist: () => 'orbit.list_index(' + ref(b, 'LIST') + ', ' + i('ITEM') + ')',
            data_lengthoflist: () => 'len(' + ref(b, 'LIST') + ')',
            data_listcontainsitem: () => 'orbit.list_contains(' + ref(b, 'LIST') + ', ' + i('ITEM') + ')',
            argument_reporter_string_number: () => activeArgs.get(field(b, 'VALUE')) || 'orbit.argument(' + f('VALUE') + ')',
            argument_reporter_boolean: () => activeArgs.get(field(b, 'VALUE')) || 'orbit.argument(' + f('VALUE') + ')',
            motion_xposition: () => 'sprite.x', motion_yposition: () => 'sprite.y', motion_direction: () => 'sprite.direction',
            looks_size: () => 'sprite.size', sound_volume: () => 'sprite.volume',
            looks_costumenumbername: () => 'sprite.costume(' + f('NUMBER_NAME') + ')',
            looks_backdropnumbername: () => 'stage.backdrop(' + f('NUMBER_NAME') + ')',
            sensing_answer: () => 'orbit.answer', sensing_timer: () => 'orbit.timer',
            sensing_loudness: () => 'orbit.loudness', sensing_mousex: () => 'orbit.mouse_x',
            sensing_mousey: () => 'orbit.mouse_y', sensing_mousedown: () => 'orbit.mouse_down',
            sensing_username: () => 'orbit.username', sensing_dayssince2000: () => 'orbit.days_since_2000',
            sensing_touchingobject: () => 'sprite.touching(' + i('TOUCHINGOBJECTMENU') + ')',
            sensing_touchingcolor: () => 'sprite.touching_color(' + i('COLOR') + ')',
            sensing_coloristouchingcolor: () => 'sprite.color_touching(' + i('COLOR') + ', ' + i('COLOR2') + ')',
            sensing_distanceto: () => 'sprite.distance_to(' + i('DISTANCETOMENU') + ')',
            sensing_keypressed: () => 'orbit.key_pressed(' + i('KEY_OPTION') + ')',
            sensing_current: () => 'orbit.current(' + f('CURRENTMENU') + ')',
            sensing_of: () => 'orbit.attribute(' + i('OBJECT') + ', ' + f('PROPERTY') + ')'
        };
        if (expr[b.opcode]) return expr[b.opcode]();
        // Shadow menu blocks are literals, not executable extension commands.
        if (b.shadow && Object.keys(b.fields || {}).length === 1) return literal(Object.values(b.fields)[0][0]);
        return missing(b.opcode);
    };
    const simple = {
        motion_movesteps: ['move', 'STEPS'], motion_turnright: ['turn_right', 'DEGREES'],
        motion_turnleft: ['turn_left', 'DEGREES'], motion_gotoxy: ['go_to', 'X', 'Y'],
        motion_goto: ['go_to_target', 'TO'], motion_pointindirection: ['point_direction', 'DIRECTION'],
        motion_pointtowards: ['point_towards', 'TOWARDS'], motion_changexby: ['change_x', 'DX'],
        motion_setx: ['set_x', 'X'], motion_changeyby: ['change_y', 'DY'], motion_sety: ['set_y', 'Y'],
        motion_ifonedgebounce: ['bounce_on_edge'], motion_setrotationstyle: ['set_rotation_style', '$STYLE'],
        motion_glidesecstoxy: ['await:glide_to', 'SECS', 'X', 'Y'],
        motion_glideto: ['await:glide_to_target', 'SECS', 'TO'],
        looks_say: ['say', 'MESSAGE'], looks_think: ['think', 'MESSAGE'],
        looks_sayforsecs: ['await:say_for', 'MESSAGE', 'SECS'], looks_thinkforsecs: ['await:think_for', 'MESSAGE', 'SECS'],
        looks_switchcostumeto: ['switch_costume', 'COSTUME'], looks_nextcostume: ['next_costume'],
        looks_switchbackdropto: ['stage.switch_backdrop', 'BACKDROP'],
        looks_switchbackdroptoandwait: ['await:stage.switch_backdrop_and_wait', 'BACKDROP'],
        looks_nextbackdrop: ['stage.next_backdrop'], looks_changesizeby: ['change_size', 'CHANGE'],
        looks_setsizeto: ['set_size', 'SIZE'], looks_changeeffectby: ['change_effect', '$EFFECT', 'CHANGE'],
        looks_seteffectto: ['set_effect', '$EFFECT', 'VALUE'], looks_cleargraphiceffects: ['clear_effects'],
        looks_show: ['show'], looks_hide: ['hide'], looks_gotofrontback: ['go_to_layer', '$FRONT_BACK'],
        looks_goforwardbackwardlayers: ['move_layers', '$FORWARD_BACKWARD', 'NUM'],
        sound_play: ['start_sound', 'SOUND_MENU'], sound_playuntildone: ['await:play_sound', 'SOUND_MENU'],
        sound_stopallsounds: ['orbit.stop_all_sounds'], sound_changeeffectby: ['change_sound_effect', '$EFFECT', 'VALUE'],
        sound_seteffectto: ['set_sound_effect', '$EFFECT', 'VALUE'], sound_cleareffects: ['clear_sound_effects'],
        sound_changevolumeby: ['change_volume', 'VOLUME'], sound_setvolumeto: ['set_volume', 'VOLUME'],
        event_broadcast: ['orbit.broadcast', 'BROADCAST_INPUT'],
        event_broadcastandwait: ['await:orbit.broadcast_and_wait', 'BROADCAST_INPUT'],
        sensing_askandwait: ['await:orbit.ask', 'QUESTION'], sensing_resettimer: ['orbit.reset_timer'],
        sensing_setdragmode: ['set_drag_mode', '$DRAG_MODE'], control_wait: ['await:orbit.wait', 'DURATION'],
        control_create_clone_of: ['orbit.create_clone', 'CLONE_OPTION'],
        pen_clear: ['orbit.clear_pen'], pen_stamp: ['stamp'], pen_penDown: ['pen_down'], pen_penUp: ['pen_up'],
        pen_setPenColorToColor: ['set_pen_color', 'COLOR'],
        pen_changePenColorParamBy: ['change_pen_parameter', 'COLOR_PARAM', 'VALUE'],
        pen_setPenColorParamTo: ['set_pen_parameter', 'COLOR_PARAM', 'VALUE'],
        pen_changePenSizeBy: ['change_pen_size', 'SIZE'], pen_setPenSizeTo: ['set_pen_size', 'SIZE'],
        music_playDrumForBeats: ['await:orbit.play_drum', 'DRUM', 'BEATS'],
        music_restForBeats: ['await:orbit.rest', 'BEATS'],
        music_playNoteForBeats: ['await:orbit.play_note', 'NOTE', 'BEATS'],
        music_setInstrument: ['orbit.set_instrument', 'INSTRUMENT'],
        music_setTempo: ['orbit.set_tempo', 'TEMPO'], music_changeTempo: ['orbit.change_tempo', 'TEMPO']
    };
    const lines = [
        '# Blocks Orbit — Python learning view',
        '# Generated from blocks; edit the blocks to update this view.',
        '# Illustrative orbit API: this preview cannot run as standalone Python.',
        '# orbit helpers preserve Scratch concepts (events, coercion, 1-based lists).',
        '# Target: ' + quote(target.name),
        'import orbit  # conceptual API; no Python runtime is included',
        '', 'stage = orbit.stage', 'sprite = ' + (target.isStage ? 'stage' : 'orbit.sprite(' + quote(target.name) + ')'), ''
    ];
    const add = (depth, line) => lines.push('    '.repeat(depth) + line);
    for (const t of (target.isStage ? [target] : [stage, target])) {
        const owner = t.isStage ? 'stage' : 'sprite';
        for (const [, [name, value]] of Object.entries(t.variables || {})) lines.push(owner + '.variables[' + quote(name) + '] = ' + literal(value));
        for (const [, [name, value]] of Object.entries(t.lists || {})) lines.push(owner + '.lists[' + quote(name) + '] = ' + literal(value));
    }
    const chain = (id, depth, ancestors = new Set()) => {
        let count = 0;
        const seen = new Set(ancestors);
        while (id) {
            if (seen.has(id) || depth > 60) { warnings.add('Circular or excessively nested block stack'); add(depth, '# Stack could not be fully translated'); add(depth, 'pass'); break; }
            seen.add(id);
            const b = blocks[id];
            if (!b || Array.isArray(b)) break;
            count++;
            const i = key => input(b, key), f = key => quote(field(b, key));
            const sub = key => chain(b.inputs?.[key]?.[1], depth + 1, seen);
            if (simple[b.opcode]) {
                let [name, ...keys] = simple[b.opcode];
                const prefix = name.startsWith('await:') ? 'await ' : '';
                name = name.replace('await:', '');
                add(depth, prefix + (name.includes('.') ? name : 'sprite.' + name) + '(' +
                    keys.map(k => k.startsWith('$') ? f(k.slice(1)) : i(k)).join(', ') + ')');
            } else switch (b.opcode) {
            case 'control_repeat':
                add(depth, 'for _ in range(orbit.repeat_count(' + i('TIMES') + ')):'); sub('SUBSTACK'); break;
            case 'control_forever':
                add(depth, 'while True:'); sub('SUBSTACK'); add(depth + 1, 'await orbit.next_frame()'); break;
            case 'control_repeat_until':
                add(depth, 'while not orbit.truth(' + i('CONDITION') + '):'); sub('SUBSTACK'); add(depth + 1, 'await orbit.next_frame()'); break;
            case 'control_wait_until':
                add(depth, 'while not orbit.truth(' + i('CONDITION') + '):'); add(depth + 1, 'await orbit.next_frame()'); break;
            case 'control_if': case 'control_if_else':
                add(depth, 'if orbit.truth(' + i('CONDITION') + '):'); sub('SUBSTACK');
                if (b.opcode === 'control_if_else') { add(depth, 'else:'); sub('SUBSTACK2'); } break;
            case 'control_stop':
                add(depth, 'orbit.stop(' + f('STOP_OPTION') + ')');
                if (field(b, 'STOP_OPTION') !== 'other scripts in sprite') add(depth, 'return');
                break;
            case 'control_delete_this_clone': add(depth, 'sprite.delete_clone()'); add(depth, 'return'); break;
            case 'data_setvariableto': add(depth, ref(b, 'VARIABLE') + ' = ' + i('VALUE')); break;
            case 'data_changevariableby': add(depth, ref(b, 'VARIABLE') + ' = orbit.number(' + ref(b, 'VARIABLE') + ') + orbit.number(' + i('VALUE') + ')'); break;
            case 'data_addtolist': add(depth, ref(b, 'LIST') + '.append(' + i('ITEM') + ')'); break;
            case 'data_deletealloflist': add(depth, ref(b, 'LIST') + '.clear()'); break;
            case 'data_deleteoflist': add(depth, 'orbit.list_delete(' + ref(b, 'LIST') + ', ' + i('INDEX') + ')'); break;
            case 'data_insertatlist': add(depth, 'orbit.list_insert(' + ref(b, 'LIST') + ', ' + i('INDEX') + ', ' + i('ITEM') + ')'); break;
            case 'data_replaceitemoflist': add(depth, 'orbit.list_replace(' + ref(b, 'LIST') + ', ' + i('INDEX') + ', ' + i('ITEM') + ')'); break;
            case 'data_showvariable': case 'data_hidevariable': case 'data_showlist': case 'data_hidelist':
                add(depth, 'orbit.' + (b.opcode.includes('_show') ? 'show_monitor' : 'hide_monitor') + '(' + ref(b, b.opcode.endsWith('list') ? 'LIST' : 'VARIABLE') + ')'); break;
            case 'procedures_call': {
                const p = procedures.get(b.mutation?.proccode);
                if (p) add(depth, 'await ' + p.name + '(' + p.ids.map(i).join(', ') + ')');
                else add(depth, missing('procedures_call: ' + (b.mutation?.proccode || 'missing definition')));
                break;
            }
            default: add(depth, expression(id)); break;
            }
            id = b.next;
        }
        if (!count) add(depth, 'pass');
    };
    const hats = {
        event_whenflagclicked: b => '@orbit.when_green_flag',
        event_whenkeypressed: b => '@orbit.when_key_pressed(' + quote(field(b, 'KEY_OPTION')) + ')',
        event_whenthisspriteclicked: b => '@sprite.when_clicked',
        event_whenstageclicked: b => '@stage.when_clicked',
        event_whenbackdropswitchesto: b => '@orbit.when_backdrop(' + quote(field(b, 'BACKDROP')) + ')',
        event_whenbroadcastreceived: b => '@orbit.when_broadcast(' + quote(field(b, 'BROADCAST_OPTION')) + ')',
        event_whengreaterthan: b => '@orbit.when_greater_than(' + quote(field(b, 'WHENGREATERTHANMENU')) + ', lambda: ' + input(b, 'VALUE') + ')',
        control_start_as_clone: b => '@sprite.when_clone_started'
    };
    tops.forEach(([id, b], index) => {
        lines.push('');
        activeArgs = new Map();
        if (b.opcode === 'procedures_definition') {
            const m = blocks[b.inputs?.custom_block?.[1]]?.mutation;
            const p = procedures.get(m?.proccode);
            if (!p) { lines.push(missing('procedures_definition')); return; }
            p.names.forEach((name, n) => activeArgs.set(name, 'arg_' + (n + 1)));
            lines.push('# Custom block: ' + quote(m.proccode));
            if (p.warp) lines.push('@orbit.without_screen_refresh');
            lines.push('async def ' + p.name + '(' + p.names.map((_, n) => 'arg_' + (n + 1)).join(', ') + '):');
            chain(b.next, 1);
        } else if (hats[b.opcode]) {
            lines.push(hats[b.opcode](b), 'async def script_' + (index + 1) + '():');
            chain(b.next, 1);
        } else {
            lines.push('# Unattached stack: runs only when clicked in the block editor.',
                'async def unattached_' + (index + 1) + '():');
            chain(id, 1);
        }
    });
    if (!tops.length) lines.push('# No scripts yet. Drag blocks into the workspace to begin.');
    return {code: lines.join('\n') + '\n', warnings: [...warnings], name: target.name};
}
module.exports = {generatePython};
