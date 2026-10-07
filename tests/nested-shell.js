// Run in an isolated GNOME Shell, with animations enabled:
// (async () => (await import('file:///path/to/chakra-switch/tests/nested-shell.js')).run())()
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import PeekView from '../src/PeekView.js';
import ChakraSwitcher from '../src/ChakraSwitcher.js';
import {buildLayout} from '../src/DiagonalBlade.js';

const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

function check(condition, message) {
    if (!condition) throw new Error(message);
}

function fixture(count) {
    const windows = [];
    for (let i = 0; i < count; i++) {
        const actor = new Clutter.Actor({width: 500, height: 400, opacity: 255});
        actor.add_child(new Clutter.Actor({width: 500, height: 400}));
        Main.uiGroup.add_child(actor);
        const win = {
            get_compositor_private: () => actor,
            get_frame_rect: () => ({width: 500, height: 400}),
            is_skip_taskbar: () => false,
            get_title: () => `Test ${i}`,
            get_workspace: () => global.workspace_manager.get_active_workspace(),
            activate: () => {},
        };
        actor.get_meta_window = () => win;
        windows.push({win, actor, app: {
            get_name: () => `Test ${i}`,
            create_icon_texture: size => new St.Icon({icon_name: 'application-x-executable', icon_size: size}),
        }});
    }
    return windows;
}

export async function run() {
    const root = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent();
    const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
        root.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(), false);
    const settings = new Gio.Settings({settings_schema:
        schemaSource.lookup('org.gnome.shell.extensions.chakra-switch', false)});
    settings.set_int('peek-show-duration-ms', 250);
    settings.set_int('focus-duration-ms', 50);
    const getActors = global.get_window_actors;
    const passed = [];
    let windows = fixture(5);
    let switcher = null;
    let peek = null;
    const parent = new St.Widget();
    Main.uiGroup.add_child(parent);
    global.get_window_actors = () => windows.map(w => w.actor);
    try {
        peek = new PeekView(parent, settings);
        peek.setWindows(windows.map(w => w.win));
        peek.show(windows[0].win);
        check(peek._container.get_transition('opacity'), 'show must schedule a real opacity transition');
        peek.hide(); // No frame has run; opacity is still zero here.
        await sleep(400);
        check(peek._container.opacity === 0 && peek._container.get_n_children() === 0,
            'quick dismissal must never leave a preview');
        check(windows.every(w => w.actor.opacity === 255 && !w.actor.get_transition('opacity')),
            'quick dismissal must restore windows and cancel pending fades');
        passed.push('release before first animation frame');

        peek.setWindows(windows.map(w => w.win));
        peek.show(windows[0].win);
        await sleep(60);
        peek.hide();
        peek.setWindows(windows.map(w => w.win));
        peek.show(windows[1].win);
        await sleep(400);
        check(peek._container.opacity > 0 && peek._container.get_n_children() === 5,
            'reopened preview must remain visible');
        peek.hide();
        passed.push('dismiss and reopen during fade');

        peek.setWindows(windows.map(w => w.win));
        peek.show(windows[0].win);
        const previewActor = peek._container;
        peek.destroy();
        peek = null;
        await sleep(300);
        check(!Main.uiGroup.get_children().includes(previewActor), 'destroy must remove preview actor');
        check(windows.every(w => w.actor.opacity === 255), 'destroy must restore windows');
        passed.push('destroy while preview is appearing');

        peek = new PeekView(parent, settings);
        peek.setWindows(windows.map(w => w.win));
        peek.show(windows[0].win);
        const closed = windows.pop();
        closed.actor.destroy();
        check(!peek._savedOpacities.has(closed.actor), 'closed windows must be dropped from opacity tracking');
        peek.hide();
        peek.destroy();
        peek = null;
        passed.push('window closes while preview is active');

        for (const w of windows) w.actor.destroy();
        windows = [];
        for (const count of [1, 2, 3, 5, 8]) {
            windows = fixture(count);
            switcher = new ChakraSwitcher(settings);
            switcher._buildWindowList = () => {
                switcher._container.destroy_all_children();
                switcher._peekView.reset();
                switcher._peekView.setWindows(windows.map(w => w.win));
                const layout = buildLayout(switcher._container, windows, Main.layoutManager.primaryMonitor, settings, () => {});
                switcher._cards = layout.cards;
                switcher._layoutCenter = layout.center;
                switcher._updateLayout = layout.updateLayout;
            };
            switcher.show();
            check(switcher._selectedIndex === Math.min(1, count - 1), `initial selection for ${count}`);
            const initial = switcher._selectedIndex;
            for (const backward of [false, true]) {
                for (let step = 0; step < count; step++) {
                    switcher.toggle(backward);
                    const selected = switcher._cards[switcher._selectedIndex].actor;
                    check(selected._targetX === switcher._layoutCenter.x - settings.get_int('card-width') / 2,
                        `selected icon must be centered with ${count} windows`);
                    for (let i = 0; i < count; i++) {
                        const icon = switcher._cards[i].actor;
                        const preview = switcher._peekView._previews[i];
                        check(icon._carouselDist === preview._flowDist, `icon/preview circular order with ${count} windows`);
                        if (icon._carouselWrapped)
                            check(icon.x === icon._targetX, 'wrapped icon must be moved before fading in');
                    }
                    await sleep(70);
                }
                check(switcher._selectedIndex === initial, 'one full cycle must return to initial selection');
            }
            switcher._onKeyPress(null, {get_key_symbol: () => Clutter.KEY_Escape, get_state: () => 0});
            await sleep(250);
            check(!switcher._isShowing && !switcher._modalGrab && !switcher._container.visible,
                'Escape must release modal grab and dismiss cards');
            check(switcher._peekView._container.get_n_children() === 0, 'Escape must remove previews');
            switcher.show(true);
            check(switcher._selectedIndex === count - 1, 'backward initial selection');
            switcher.hide();
            switcher.show(); // Reopen before the card dismissal finishes.
            await sleep(250);
            check(switcher._isShowing && switcher._container.visible && switcher._container.opacity === 255,
                'stale dismissal must not hide reopened cards');
            switcher._onKeyRelease(null, {get_key_symbol: () => Clutter.KEY_Alt_L});
            await sleep(250);
            check(!switcher._isShowing && switcher._peekView._container.opacity === 0,
                'Alt release must close the switcher');
            switcher.show();
            const actor = switcher._peekView._container;
            switcher.destroy();
            switcher = null;
            await sleep(300);
            check(!Main.uiGroup.get_children().includes(actor), 'switcher destroy must remove preview actor');
            check(windows.every(w => w.actor.opacity === 255), 'switcher destroy must restore all windows');
            for (const w of windows) w.actor.destroy();
            windows = [];
            passed.push(`carousel, keyboard dismissal, rapid reopen and disable: ${count} windows`);
        }
        return passed;
    } finally {
        switcher?.destroy();
        peek?.destroy();
        parent.destroy();
        for (const w of windows) w.actor.destroy();
        global.get_window_actors = getActors;
    }
}
