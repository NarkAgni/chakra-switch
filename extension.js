/*
* Chakra Switch GNOME Extension
* Copyright (C) 2026 NarkAgni
* * This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* any later version.
* * This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
* * You should have received a copy of the GNU General Public License
* along with this program. If not, see https://www.gnu.org/licenses/. 
*/


import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import ChakraSwitcher from './src/ChakraSwitcher.js';


const BINDINGS = [
    'switch-applications',
    'switch-applications-backward',
    'switch-windows',
    'switch-windows-backward',
];


export default class ChakraSwitchExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._switcher = new ChakraSwitcher(this._settings);

        this._bindSwitcher();
        this._overviewChangedId = this._settings.connect('changed::open-in-overview',
            () => this._bindSwitcher());
    }

    _bindSwitcher() {
        const actionModes = this._settings.get_boolean('open-in-overview')
            ? Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
            : Shell.ActionMode.NORMAL;

        BINDINGS.forEach(binding => {
            Main.wm.setCustomKeybindingHandler(binding, actionModes, () => {
                this._switcher.toggle(binding.includes('backward'));
            });
        });
    }

    disable() {
        this._settings.disconnect(this._overviewChangedId);
        this._settings = null;

        // Hand the bindings back the way GNOME registers them: normal mode only.
        BINDINGS.forEach(binding => {
            Main.wm.setCustomKeybindingHandler(binding, Shell.ActionMode.NORMAL,
                Main.wm._startSwitcher.bind(Main.wm));
        });

        if (this._switcher) {
            this._switcher.destroy();
            this._switcher = null;
        }
    }
}