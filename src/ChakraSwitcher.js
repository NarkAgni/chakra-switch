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
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import PeekView from './PeekView.js';
import { buildLayout } from './DiagonalBlade.js';
import { playEntrySequence } from './LayoutAnimator.js';


export default class ChakraSwitcher {
    constructor(settings) {
        this._settings      = settings;
        this._isShowing     = false;
        this._selectedIndex = 0;
        this._cards         = [];
        this._modalGrab     = null;
        this._layoutCenter  = { x: 0, y: 0 };
        this._updateLayout  = null;
        this._disableHover  = false;
        this._lastScrollTime = 0;

        this._overlay = new St.Widget({
            style_class: 'chakra-fullscreen-overlay',
            reactive: true,
        });

        this._container = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            can_focus: true,
            reactive: true,
        });

        this._container.visible = false;
        this._overlay.visible   = false;

        this._peekView = new PeekView(this._container, settings);

        Main.uiGroup.add_child(this._overlay);
        Main.uiGroup.add_child(this._container);

        const uiGroup = Main.layoutManager.uiGroup;
        this._overlay.add_constraint(new Clutter.BindConstraint({
            source: uiGroup, coordinate: Clutter.BindCoordinate.ALL,
        }));
        this._container.add_constraint(new Clutter.BindConstraint({
            source: uiGroup, coordinate: Clutter.BindCoordinate.ALL,
        }));

        this._container.connect('key-press-event',   this._onKeyPress.bind(this));
        this._container.connect('key-release-event', this._onKeyRelease.bind(this));
        this._overlay.connect('motion-event',        this._onPointerMotion.bind(this));
        this._container.connect('motion-event',      this._onPointerMotion.bind(this));
        this._overlay.connect('button-press-event',  this._onPointerClick.bind(this));
        this._container.connect('button-press-event', this._onPointerClick.bind(this));
        this._overlay.connect('scroll-event',        this._onScroll.bind(this));
        this._container.connect('scroll-event',      this._onScroll.bind(this));
    }

    _buildWindowList() {
        this._container.destroy_all_children();
        this._peekView.reset();
        this._cards        = [];
        this._updateLayout = null;
        this._disableHover = false;

        const workspace = global.workspace_manager.get_active_workspace();
        const tracker   = Shell.WindowTracker.get_default();

        const windows = workspace.list_windows()
            .filter(win => win.get_window_type() === Meta.WindowType.NORMAL && !win.is_skip_taskbar())
            .map(win => ({ win, app: tracker.get_window_app(win), lastFocused: win.get_user_time() }))
            .filter(({ app }) => !!app)
            .sort((a, b) => b.lastFocused - a.lastFocused);

        if (windows.length === 0) return;

        const monitor = Main.layoutManager.primaryMonitor;
        const result  = buildLayout(this._container, windows, monitor, this._settings, (win) => this.hide(false, win));

        this._cards        = result.cards;
        this._layoutCenter = result.center;
        this._updateLayout = result.updateLayout || null;
        this._disableHover = result.disableHover || false;
    }

    _onScroll(actor, event) {
        if (!this._isShowing || !this._cards.length) return Clutter.EVENT_PROPAGATE;
        if (!this._disableHover) return Clutter.EVENT_PROPAGATE;

        const now = Date.now();
        if (now - this._lastScrollTime < 150) return Clutter.EVENT_STOP;

        const direction = event.get_scroll_direction();
        let dx = 0, dy = 0;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            [dx, dy] = event.get_scroll_delta();
        } else if (direction === Clutter.ScrollDirection.UP)    dy = -1;
        else if (direction === Clutter.ScrollDirection.DOWN)    dy = 1;
        else if (direction === Clutter.ScrollDirection.LEFT)    dx = -1;
        else if (direction === Clutter.ScrollDirection.RIGHT)   dx = 1;

        if (dy < 0 || dx < 0) {
            this.toggle(true);
            this._lastScrollTime = now;
            return Clutter.EVENT_STOP;
        } else if (dy > 0 || dx > 0) {
            this.toggle(false);
            this._lastScrollTime = now;
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onPointerMotion(actor, event) {
        if (!this._isShowing || !this._cards.length) return Clutter.EVENT_PROPAGATE;
        if (this._disableHover) return Clutter.EVENT_PROPAGATE;

        const [stageX, stageY] = event.get_coords();
        const skew = this._settings.get_int('skew');
        const w    = this._settings.get_int('card-width');
        const h    = this._settings.get_int('card-height');

        const polygon = [
            [skew,         0],
            [w,            0],
            [w - skew,     h],
            [0,            h],
        ];

        let hitIndex = -1;

        for (let i = 0; i < this._cards.length; i++) {
            const card = this._cards[i];
            if (!card || !card.actor) continue;
            if (card.actor._baseOpacity === 0) continue;

            const [success, localX, localY] = card.actor.transform_stage_point(stageX, stageY);
            if (!success) continue;

            let inside = false;
            for (let p = 0, j = polygon.length - 1; p < polygon.length; j = p++) {
                const xi = polygon[p][0], yi = polygon[p][1];
                const xj = polygon[j][0], yj = polygon[j][1];
                const intersect = ((yi > localY) !== (yj > localY))
                    && (localX < (xj - xi) * (localY - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }

            if (inside) { hitIndex = i; break; }
        }

        if (hitIndex !== -1 && hitIndex !== this._selectedIndex) {
            this._selectedIndex = hitIndex;
            this._applyFocus(false);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onPointerClick(actor, event) {
        if (!this._isShowing || !this._cards.length) return Clutter.EVENT_PROPAGATE;
        const win = this._cards[this._selectedIndex]?.window;
        if (win) {
            this.hide(false, win);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _applyFocus(isEntry = false) {
        if (!this._cards.length) return;

        if (this._updateLayout) {
            this._updateLayout(this._cards, this._selectedIndex, this._layoutCenter, this._container);
        }

        const focusDuration = this._settings.get_int('focus-duration-ms');
        const focusScale    = this._settings.get_int('focus-scale') / 100;

        for (let i = 0; i < this._cards.length; i++) {
            const card      = this._cards[i];
            if (!card) continue;
            const isFocused = i === this._selectedIndex;

            const baseScale   = card.actor._baseScale   || 1.0;
            const baseOpacity = card.actor._baseOpacity !== undefined ? card.actor._baseOpacity : 255;
            const targetX     = card.actor._targetX !== undefined ? card.actor._targetX : card.actor.x;
            const targetY     = card.actor._targetY !== undefined ? card.actor._targetY : card.actor.y;

            if (isFocused) {
                try { this._peekView.show(card.window); } catch (e) {}
                card.actor.add_style_class_name('chakra-window-card-focused');

                if (!isEntry) {
                    card.actor.ease({
                        x: targetX, y: targetY,
                        scale_x: baseScale * focusScale,
                        scale_y: baseScale * focusScale,
                        opacity: 255,
                        duration: focusDuration,
                        mode: Clutter.AnimationMode.EASE_OUT_QUINT,
                    });
                } else {
                    card.actor.set_position(targetX, targetY);
                }
            } else {
                card.actor.remove_style_class_name('chakra-window-card-focused');

                if (!isEntry) {
                    card.actor.ease({
                        x: targetX, y: targetY,
                        scale_x: baseScale,
                        scale_y: baseScale,
                        opacity: baseOpacity,
                        duration: Math.round(focusDuration * 0.85),
                        mode: Clutter.AnimationMode.EASE_OUT_QUINT,
                    });
                } else {
                    card.actor.set_position(targetX, targetY);
                }
            }
        }
    }

    _onKeyPress(actor, event) {
        const sym   = event.get_key_symbol();
        const state = event.get_state();
        const shift = (state & Clutter.ModifierType.SHIFT_MASK) !== 0;

        if (sym === Clutter.KEY_Print || sym === Clutter.KEY_sysrq) {
            this.hide();
            return Clutter.EVENT_PROPAGATE;
        }
        if (sym === Clutter.KEY_Tab || sym === Clutter.KEY_ISO_Left_Tab) {
            this._selectedIndex = shift
                ? (this._selectedIndex - 1 + this._cards.length) % this._cards.length
                : (this._selectedIndex + 1) % this._cards.length;
            this._applyFocus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Right || sym === Clutter.KEY_Down) {
            this._selectedIndex = (this._selectedIndex + 1) % this._cards.length;
            this._applyFocus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Left || sym === Clutter.KEY_Up) {
            this._selectedIndex = (this._selectedIndex - 1 + this._cards.length) % this._cards.length;
            this._applyFocus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Escape) {
            this.hide();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onKeyRelease(actor, event) {
        const sym = event.get_key_symbol();
        if (sym === Clutter.KEY_Alt_L   || sym === Clutter.KEY_Alt_R   ||
            sym === Clutter.KEY_Super_L || sym === Clutter.KEY_Super_R ||
            sym === Clutter.KEY_Meta_L  || sym === Clutter.KEY_Meta_R) {
            const win = this._cards[this._selectedIndex]?.window;
            this.hide(false, win);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    toggle(backward = false) {
        if (this._isShowing) {
            this._selectedIndex = backward
                ? (this._selectedIndex - 1 + this._cards.length) % this._cards.length
                : (this._selectedIndex + 1) % this._cards.length;
            this._applyFocus();
        } else {
            this.show(backward);
        }
    }

    show(backward = false) {
        if (this._isShowing) return;

        this._buildWindowList();
        if (this._cards.length === 0) return;

        this._selectedIndex = backward ? Math.max(0, this._cards.length - 2) : Math.min(this._cards.length, 1);
        this._container.visible = true;
        this._overlay.visible   = true;

        try {
            this._modalGrab = Main.pushModal(this._container, { actionMode: Shell.ActionMode.ALL });
        } catch (e) {
            this._container.visible = false;
            this._overlay.visible   = false;
            return;
        }

        this._container.grab_key_focus();
        this._applyFocus(true);
        playEntrySequence(this._cards, this._selectedIndex, this._settings);

        this._overlay.opacity = 0;
        this._overlay.ease({
            opacity: 255,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this._isShowing = true;
    }

    hide(isCancel = false, windowToActivate = null) {
        if (!this._isShowing) return;

        const focus = global.stage.get_key_focus();
        if (focus && this._container.contains(focus)) global.stage.set_key_focus(null);

        try {
            if (this._modalGrab) {
                Main.popModal(this._modalGrab);
                this._modalGrab = null;
            } else {
                Main.popModal(this._container);
            }
        } catch (e) {}

        this._peekView.hide();

        this._overlay.ease({
            opacity: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._overlay)    this._overlay.visible    = false;
                if (this._container)  this._container.visible  = false;
                if (windowToActivate) Main.activateWindow(windowToActivate);
            },
        });

        this._isShowing = false;
    }

    destroy() {
        try {
            if (this._modalGrab) Main.popModal(this._modalGrab);
            else Main.popModal(this._container);
        } catch (e) {}

        if (this._container) { this._container.destroy(); this._container = null; }
        if (this._overlay)   { this._overlay.destroy();   this._overlay   = null; }
    }
}