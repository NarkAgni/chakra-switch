import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


const PILL_CSS = `
    .chakra-pill-spin {
        border-radius: 999px;
        padding-left:  4px;
        padding-right: 4px;
        min-height: 34px;
    }
    .chakra-pill-spin entry,
    .chakra-pill-spin text {
        border-radius: 999px;
    }
`;

export default class ChakraPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        this._signals = [];
        this.settings = this.getSettings();

        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_string(PILL_CSS);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        window.set_default_size(660, 740);
        window.add(this._buildLayoutPage());
        window.add(this._buildAnimationPage());
        window.add(this._buildPeekPage());

        window.connect('destroy', () => {
            this._signals.forEach(id => this.settings.disconnect(id));
            this._signals = [];
        });
    }

    _buildLayoutPage() {
        const page = new Adw.PreferencesPage({
            title: 'Layout',
            icon_name: 'preferences-desktop-display-symbolic',
        });

        const cardGroup = new Adw.PreferencesGroup({ title: 'Card' });
        this._addSpin(cardGroup, 'card-width',  'Card Width',  'Horizontal size of each card in pixels',          'view-fullscreen-symbolic',       100, 600, 10);
        this._addSpin(cardGroup, 'card-height', 'Card Height', 'Vertical size of each card in pixels',            'view-fullscreen-symbolic',       100, 500, 10);
        this._addSpin(cardGroup, 'card-gap',    'Card Gap',    'Horizontal distance between card centres',        'format-justify-center-symbolic',  50, 500, 10);
        this._addSpin(cardGroup, 'skew',         'Skew',            'Diagonal lean of the blade shape',        'object-rotate-right-symbolic',    20, 200,  5);
        this._addSpin(cardGroup, 'card-opacity', 'Shape Opacity (%)', 'Transparency of the card background',   'display-brightness-symbolic',     10, 100,  5);
        page.add(cardGroup);

        const iconGroup = new Adw.PreferencesGroup({ title: 'Icon' });
        this._addSpin(iconGroup, 'icon-size', 'Icon Size', 'Base size multiplier — actual pixels displayed = value × 25', 'image-x-generic-symbolic', 4, 64, 2);
        page.add(iconGroup);

        const labelGroup = new Adw.PreferencesGroup({ title: 'App Label' });
        this._addSwitch(labelGroup, 'show-app-name',   'Show App Name',  'Display the app name on the focused card');
        this._addSpin  (labelGroup, 'text-size',       'Font Size',      'App name font size in points',                  'font-select-symbolic',            8,  32, 1);
        this._addSpin  (labelGroup, 'text-bottom-pad', 'Bottom Padding', 'Space between the text baseline and card edge', 'format-indent-more-symbolic',     2,  64, 2);
        page.add(labelGroup);

        const posGroup = new Adw.PreferencesGroup({ title: 'Position' });
        this._addSpin(posGroup, 'y-offset', 'Vertical Offset (%)', 'Shift the switcher up or down as % of screen height', 'go-up-symbolic', -50, 50, 1);
        page.add(posGroup);

        return page;
    }

    _buildAnimationPage() {
        const page = new Adw.PreferencesPage({
            title: 'Animation',
            icon_name: 'media-playback-start-symbolic',
        });

        const entryGroup = new Adw.PreferencesGroup({
            title: 'Entry',
            description: 'How cards animate into view when the switcher opens',
        });
        this._addSpin(entryGroup, 'stagger-gap-ms',   'Stagger Delay', 'Extra delay per card, counted from the focused one (ms)', 'preferences-system-time-symbolic',   0, 500,  25);
        this._addSpin(entryGroup, 'ease-duration-ms', 'Duration',      'Total time for each card to finish appearing (ms)',        'preferences-system-time-symbolic', 100, 1200, 50);
        page.add(entryGroup);

        const focusGroup = new Adw.PreferencesGroup({
            title: 'Focus',
            description: 'How the selected card reacts when you cycle between windows',
        });
        this._addSpin(focusGroup, 'focus-duration-ms', 'Duration',  'Transition time when moving focus (ms)', 'preferences-system-time-symbolic',  50,  800, 25);
        this._addSpin(focusGroup, 'focus-scale',       'Scale (%)', 'How much the focused card enlarges',     'zoom-in-symbolic',                 100,  200,  5);
        page.add(focusGroup);

        return page;
    }

    _buildPeekPage() {
        const page = new Adw.PreferencesPage({
            title: 'Peek',
            icon_name: 'view-preview-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Peek Preview',
            description: 'Live window thumbnail shown behind the switcher when a card is focused',
        });
        this._addSwitch(group, 'peek-enabled',          'Enable Peek',   'Show a live window preview on focus');
        this._addSpin  (group, 'peek-max-scale',        'Max Scale (%)', 'Maximum preview size relative to your monitor',  'zoom-fit-best-symbolic',           30, 100,  5);
        this._addSpin  (group, 'peek-opacity',          'Opacity (%)',   'Translucency of the peek preview',               'display-brightness-symbolic',      10, 100,  5);
        this._addSpin  (group, 'peek-show-duration-ms', 'Fade In (ms)', 'How fast the preview appears',                   'preferences-system-time-symbolic', 50, 600, 25);
        this._addSpin  (group, 'peek-hide-duration-ms', 'Fade Out (ms)', 'How fast the preview disappears',               'preferences-system-time-symbolic', 50, 400, 25);
        page.add(group);

        return page;
    }

    _addSpin(group, key, title, subtitle, iconName, min, max, step = 1) {
        const row = new Adw.ActionRow({ title, subtitle, icon_name: iconName });

        const spin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: min, upper: max, step_increment: step }),
            numeric: true,
            valign: Gtk.Align.CENTER,
            width_request: 110,
            css_classes: ['chakra-pill-spin'],
        });

        this.settings.bind(key, spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        row.add_suffix(spin);
        row.add_suffix(this._resetBtn(key));
        group.add(row);
    }

    _addSwitch(group, key, title, subtitle) {
        const row = new Adw.SwitchRow({ title, subtitle });
        this.settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }

    _resetBtn(key) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            valign: Gtk.Align.CENTER,
        });

        const sep = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
        sep.set_margin_top(8);
        sep.set_margin_bottom(8);
        box.append(sep);

        const btn = new Gtk.Button({
            icon_name: 'edit-undo-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular'],
            tooltip_text: 'Reset to default',
        });

        const refresh = () => {
            const atDefault = this.settings.get_value(key).equal(this.settings.get_default_value(key));
            btn.set_sensitive(!atDefault);
            btn.set_opacity(atDefault ? 0.3 : 1.0);
        };

        btn.connect('clicked', () => this.settings.reset(key));
        this._signals.push(this.settings.connect(`changed::${key}`, refresh));
        refresh();

        box.append(btn);
        return box;
    }
}