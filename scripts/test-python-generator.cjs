const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {generatePython} = require('../web/python-generator.cjs');
const b = (opcode, next = null, inputs = {}, fields = {}, extra = {}) => ({opcode, next, inputs, fields, ...extra});
const text = value => [1, [10, value]];
const num = value => [1, [4, String(value)]];
const link = id => [2, id];
const project = {targets: [
    {isStage: true, name: 'Stage', variables: {global: ['score', 0]}, lists: {list: ['results', []]}, blocks: {}},
    {isStage: false, name: 'Sprite "one"\n# safe', variables: {local: ['score', 2]}, lists: {}, blocks: {
        hat: b('event_whenflagclicked', 'set', {}, {}, {topLevel: true}),
        set: b('data_setvariableto', 'repeat', {VALUE: num(0)}, {VARIABLE: ['score', 'global']}),
        repeat: b('control_repeat', 'if', {TIMES: num(3), SUBSTACK: link('change')}),
        change: b('data_changevariableby', 'add', {VALUE: num(2)}, {VARIABLE: ['score', 'global']}),
        add: b('data_addtolist', 'move', {ITEM: text('working')}, {LIST: ['results', 'list']}),
        move: b('motion_movesteps', null, {STEPS: num(10)}),
        if: b('control_if_else', 'call', {CONDITION: link('gt'), SUBSTACK: link('say'), SUBSTACK2: link('wait')}),
        gt: b('operator_gt', null, {OPERAND1: link('local'), OPERAND2: num(1)}),
        local: b('data_variable', null, {}, {VARIABLE: ['score', 'local']}),
        say: b('looks_say', null, {MESSAGE: text('hello\n"quoted"\\text')}),
        wait: b('control_wait', null, {DURATION: num(1)}),
        call: b('procedures_call', 'unknown', {amount: num(5)}, {}, {mutation: {proccode: 'jump %s'}}),
        unknown: b('future_extension', null),
        definition: b('procedures_definition', 'customMove', {custom_block: link('proto')}, {}, {topLevel: true, y: 200}),
        proto: b('procedures_prototype', null, {}, {}, {shadow: true, mutation: {
            proccode: 'jump %s', argumentids: '["amount"]', argumentnames: '["steps"]', warp: 'true'}}),
        customMove: b('motion_movesteps', null, {STEPS: link('arg')}),
        arg: b('argument_reporter_string_number', null, {}, {VALUE: ['steps', null]}),
        loose: b('control_if', null, {CONDITION: link('bool')}, {}, {topLevel: true, y: 300}),
        bool: b('operator_not', null, {})
    }}
]};
const original = JSON.stringify(project);
const result = generatePython(project, 1);
assert.equal(JSON.stringify(project), original, 'Generator must not mutate projects');
for (const text of ['@orbit.when_green_flag', 'for _ in range(orbit.repeat_count(3)):',
    'stage.variables["score"] = 0', 'sprite.variables["score"] = 2',
    'stage.lists["results"].append("working")', 'sprite.move(10)',
    'if orbit.truth(orbit.greater_than(sprite.variables["score"], 1)):',
    'else:', 'await orbit.wait(1)', 'await custom_block_1(5)',
    'async def custom_block_1(arg_1):', 'sprite.move(arg_1)', 'pass',
    'orbit.unsupported("future_extension")']) assert(result.code.includes(text), text);
assert.equal(result.warnings.length, 1);
assert(!result.code.includes('\n# safe'), 'Target names cannot inject source');
const cyclic = {targets: [{name: 'Cycle', isStage: true, blocks: {
    a: b('control_forever', null, {SUBSTACK: link('a')}, {}, {topLevel: true})
}}]};
assert(generatePython(cyclic).warnings.length > 0);
assert(generatePython({targets: []}).code.includes('Select'));
assert(generatePython({targets: [{name: 'Empty', blocks: {}}]}).code.includes('No scripts yet'));
assert(generatePython(project, 0).name === 'Stage');
fs.writeFileSync(path.join(__dirname, '../.cache/python-preview-syntax.py'), result.code);
console.log('PASS: Nested control, events, typed inputs, variable scopes, lists, custom blocks, escaping, unknown blocks, cycles, empty targets, and immutability.');
