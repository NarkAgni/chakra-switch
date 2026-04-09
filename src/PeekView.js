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


import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';


export default class PeekView {
    constructor(parentActor, settings) {
        this._settings = settings;
        this._parent   = parentActor;

        this._container = new St.Bin({ reactive: false, opacity: 0 });

        Main.uiGroup.add_child(this._container);
        Main.uiGroup.set_child_below_sibling(this._container, this._parent);

        this._savedOpacities = new Map();
    }

    reset() {
        this._restoreWindows();
        this._container.destroy_all_children();
        this._container.opacity = 0;
    }

    _hideAllWindows() {
        global.get_window_actors().forEach(wa => {
            try {
                if (!wa) return;
                const win = wa.get_meta_window();
                if (!win || win.is_skip_taskbar()) return;
                if (!wa.get_stage() || !wa.visible) return;

                if (!this._savedOpacities.has(wa)) {
                    this._savedOpacities.set(wa, wa.opacity);
                }

                wa.ease({
                    opacity: 0,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            } catch (e) {}
        });
    }

    _restoreWindows() {
        this._savedOpacities.forEach((origOpacity, wa) => {
            try {
                if (wa && wa.get_stage()) {
                    wa.opacity = origOpacity
                }
            } catch (e) {}
        });
        this._savedOpacities.clear();
    }

    show(focusedWindow) {
        if (!focusedWindow) return;
        if (!this._settings.get_boolean('peek-enabled')) return;

        this._hideAllWindows();

        try {
            const windowActor = focusedWindow.get_compositor_private();
            if (!windowActor) return;

            let sourceActor = windowActor;
            const children  = windowActor.get_children();
            for (let i = 0; i < children.length; i++) {
                if (children[i].constructor.name.includes('Surface')) {
                    sourceActor = children[i];
                    break;
                }
            }
            if (sourceActor === windowActor && children.length > 0) {
                sourceActor = children[0];
            }

            let w = Math.max(1, sourceActor.width  || 1);
            let h = Math.max(1, sourceActor.height || 1);

            if (w <= 1 || h <= 1) {
                const rect = focusedWindow.get_frame_rect();
                w = Math.max(1, rect.width  || 1);
                h = Math.max(1, rect.height || 1);
                sourceActor = windowActor;
            }

            const maxScale  = this._settings.get_int('peek-max-scale') / 100;
            const monitor   = Main.layoutManager.primaryMonitor;
            const workArea  = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(monitor);
            const maxW      = workArea.width  * maxScale;
            const maxH      = workArea.height * maxScale;

            let previewW = w, previewH = h;
            if (previewW > maxW) { previewW = maxW; previewH = (h / w) * previewW; }
            if (previewH > maxH) { previewH = maxH; previewW = (w / h) * previewH; }

            const clone = new Clutter.Clone({ source: sourceActor, reactive: false });
            clone.set_size(previewW, previewH);

            const wrapBin = new St.Bin({
                child: clone,
                style_class: 'chakra-peek-wrap',
            });

            const targetX = workArea.x + (workArea.width  / 2) - (previewW  / 2);
            const targetY = workArea.y + (workArea.height / 2) - (previewH / 2);

            this._container.remove_all_transitions();
            this._container.destroy_all_children();
            this._container.add_child(wrapBin);
            this._container.set_size(previewW, previewH);
            this._container.set_position(targetX+workArea.width, targetY);
            this._container.set_pivot_point(0.5, 0.5);
            this._container.set_scale(0.94, 0.94);

            const targetOpacity = Math.round(this._settings.get_int('peek-opacity') / 100 * 255);
            const showDuration  = this._settings.get_int('peek-show-duration-ms');

            this._container.ease({
                opacity: targetOpacity,
                scale_x: 1.0,
                scale_y: 1.0,
                x: targetX,
                y: targetY,
                duration: showDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUINT,
            });
        } catch (e) {}
    }

    hide() {
        this._restoreWindows();

        if (this._container.opacity > 0) {
            this._container.remove_all_transitions();
            this._container.ease({
                opacity: 0,
                scale_x: 0.96,
                scale_y: 0.96,
                duration: 0,
                mode: Clutter.AnimationMode.EASE_IN_QUINT,
                onComplete: () => {
                    this._container.destroy_all_children();
                },
            });
        }
    }
}