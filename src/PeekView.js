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


const SIDE_ANGLE   = 60;    // degrees an off-centre preview turns away from the viewer
const SIDE_SCALE   = 0.86;  // each step further out shrinks by this factor
const SIDE_FADE    = 0.30;  // and loses this much opacity
const VISIBLE_SIDE = 3;     // previews kept visible on each side of the selected one

// Fractions of the peek-max-scale box that the centre preview fills. The rest
// of the width is where the turned previews live.
const CENTRE_W     = 0.74;
const CENTRE_H     = 0.98;
const FIRST_GAP    = 0.41;  // centre to the first preview beside it, in box widths
const STEP_GAP     = 0.16;  // and between each further one


// The window's own surface, not its MetaWindowActor: _hideAllWindows() fades
// the window actors to 0 while the switcher is up and a clone would inherit it.
function cloneOf(win) {
    const actor = win.get_compositor_private();
    if (!actor) return null;

    let source = actor;
    const children = actor.get_children();
    for (let i = 0; i < children.length; i++) {
        if (children[i].constructor.name.includes('Surface')) {
            source = children[i];
            break;
        }
    }
    if (source === actor && children.length > 0) source = children[0];

    let w = Math.max(1, source.width  || 1);
    let h = Math.max(1, source.height || 1);

    if (w <= 1 || h <= 1) {
        const rect = win.get_frame_rect();
        w = Math.max(1, rect.width  || 1);
        h = Math.max(1, rect.height || 1);
        source = actor;
    }
    if (w <= 1 || h <= 1) return null;

    const clone = new Clutter.Clone({ source, reactive: false });
    return { clone, w, h };
}


export default class PeekView {
    constructor(parentActor, settings) {
        this._settings = settings;
        this._parent   = parentActor;
        this._windows  = [];
        this._previews = [];
        this._center   = { x: 0, y: 0 };
        this._boxW     = 0;
        this._built    = false;

        this._container = new St.Widget({ reactive: false, opacity: 0 });

        Main.uiGroup.add_child(this._container);
        Main.uiGroup.set_child_below_sibling(this._container, this._parent);

        this._container.add_constraint(new Clutter.BindConstraint({
            source: Main.layoutManager.uiGroup,
            coordinate: Clutter.BindCoordinate.ALL,
        }));

        this._savedOpacities = new Map();
    }

    // called by the switcher with the same list, in the same order, as the cards
    setWindows(windows) {
        this._windows = windows;
        this._built   = false;
    }

    reset() {
        this._restoreWindows();
        this._container.remove_all_transitions();
        this._container.destroy_all_children();
        this._container.opacity = 0;
        this._previews = [];
        this._built    = false;
        this._windows  = [];
    }

    _hideAllWindows() {
        global.get_window_actors().forEach(wa => {
            try {
                if (!wa) return;
                const win = wa.get_meta_window();
                if (!win || win.is_skip_taskbar()) return;
                if (!wa.get_stage() || !wa.visible) return;

                if (!this._savedOpacities.has(wa)) {
                    const opacity = wa.opacity;
                    const destroyId = wa.connect('destroy', () => this._savedOpacities.delete(wa));
                    this._savedOpacities.set(wa, {opacity, destroyId});
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
        this._savedOpacities.forEach(({opacity, destroyId}, wa) => {
            try {
                wa.disconnect(destroyId);
                if (wa && wa.get_stage()) {
                    // A fast Alt+Tab can finish before the fade has started.
                    // Cancel it before restoring, or it will hide the window later.
                    wa.remove_transition('opacity');
                    wa.opacity = opacity;
                }
            } catch (e) {}
        });
        this._savedOpacities.clear();
    }

    _build() {
        this._container.destroy_all_children();
        this._previews = [];

        const monitor  = Main.layoutManager.primaryMonitor;
        const workArea = global.workspace_manager.get_active_workspace()
            .get_work_area_for_monitor(monitor);
        const maxScale = this._settings.get_int('peek-max-scale') / 100;

        // the centre preview only gets part of the width: the rest is where the
        // turned previews on either side live
        const boxW = workArea.width  * maxScale * CENTRE_W;
        const boxH = workArea.height * maxScale * CENTRE_H;

        for (const win of this._windows) {
            const made = cloneOf(win);
            if (!made) { this._previews.push(null); continue; }

            const scale = Math.min(boxW / made.w, boxH / made.h);
            const pw    = Math.max(1, Math.round(made.w * scale));
            const ph    = Math.max(1, Math.round(made.h * scale));

            made.clone.set_size(pw, ph);

            const wrap = new St.Bin({
                child: made.clone,
                style_class: 'chakra-peek-wrap',
                width: pw,
                height: ph,
            });

            this._container.add_child(wrap);
            this._previews.push(wrap);
        }

        this._center = {
            x: workArea.x + workArea.width  / 2,
            y: workArea.y + workArea.height / 2,
        };
        this._boxW = boxW;
        this._built = true;
    }

    _layout(selected, duration) {
        const gap   = this._boxW * FIRST_GAP;
        const step  = this._boxW * STEP_GAP;
        const total = this._previews.length;
        const order = [];

        for (let i = 0; i < this._previews.length; i++) {
            const p = this._previews[i];
            if (!p) continue;

            // shortest way round: the flow wraps, so what leaves one side
            // comes back on the other
            let dist = i - selected;
            if (dist >  total / 2) dist -= total;
            else if (dist < -total / 2) dist += total;

            const side = Math.sign(dist);
            const away = Math.abs(dist);

            const scale   = Math.pow(SIDE_SCALE, away);
            const opacity = away === 0
                ? 255
                : (away > VISIBLE_SIDE ? 0 : Math.round(255 * (1 - away * SIDE_FADE)));

            // hinge on the edge nearest the centre, the way coverflow does
            p.set_pivot_point(side < 0 ? 0 : (side > 0 ? 1 : 0.5), 0.5);

            const offset = side === 0 ? 0 : side * (gap + (away - 1) * step);
            const targetX = Math.round(this._center.x - p.width  / 2 + offset);
            const targetY = Math.round(this._center.y - p.height / 2);

            const angle = -side * SIDE_ANGLE;

            const place = () => {
                p.set_position(targetX, targetY);
                p.set_scale(scale, scale);
                p.rotation_angle_y = angle;
            };

            // A preview that went round the back would otherwise slide the whole
            // way across the screen to get there. Put it in its new place while
            // it is invisible, then fade it back in.
            const last    = p._flowDist;
            const wrapped = last !== undefined && Math.abs(dist - last) > 1;

            if (duration > 0 && !wrapped) {
                p.ease({
                    x: targetX,
                    y: targetY,
                    scale_x: scale,
                    scale_y: scale,
                    rotation_angle_y: angle,
                    opacity,
                    duration,
                    mode: Clutter.AnimationMode.EASE_OUT_QUINT,
                });
            } else if (wrapped) {
                p.remove_all_transitions();
                place();
                p.opacity = 0;
                p.ease({
                    opacity,
                    duration,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            } else {
                place();
                p.opacity = opacity;
            }

            p._flowDist = dist;
            order.push({ actor: p, away });
        }

        // the selected preview on top, the rest stacked outwards behind it
        order.sort((a, b) => b.away - a.away);
        for (const item of order) {
            this._container.set_child_above_sibling(item.actor, null);
        }
    }

    show(focusedWindow) {
        if (!focusedWindow) return;
        if (!this._settings.get_boolean('peek-enabled')) return;

        try {
            if (!this._built) this._build();

            const selected = this._windows.indexOf(focusedWindow);
            if (selected < 0 || !this._previews[selected]) return;

            this._hideAllWindows();

            const targetOpacity = Math.round(this._settings.get_int('peek-opacity') / 100 * 255);
            const showDuration  = this._settings.get_int('peek-show-duration-ms');
            const first         = this._container.opacity === 0;

            // first appearance drops into place, later ones slide between previews
            this._layout(selected, first ? 0 : this._settings.get_int('focus-duration-ms'));

            if (first) {
                this._container.remove_all_transitions();
                this._container.ease({
                    opacity: targetOpacity,
                    duration: showDuration,
                    mode: Clutter.AnimationMode.EASE_OUT_QUINT,
                });
            }
        } catch (e) {
            this.reset();
        }
    }

    hide() {
        // Opacity is still zero until the first frame of the show transition.
        // Always cancel and clear it, including when Alt was released immediately.
        this.reset();
    }

    destroy() {
        this.reset();
        this._container.destroy();
        this._container = null;
        this._parent = null;
    }
}
