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
import cairo from 'gi://cairo';
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import PangoCairo from 'gi://PangoCairo';


const CARD_COLORS = {
    base:   { fill: [0.06, 0.06, 0.08], border: [0.40, 0.50, 0.60] },
    active: { fill: [0.08, 0.08, 0.10], border: [0.95, 0.10, 0.10] },
};

function tracePath(cr, w, h, skew) {
    const r = 20;

    function normalize(dx, dy) {
        const len = Math.sqrt(dx * dx + dy * dy);
        return [dx / len, dy / len];
    }

    const [tx, ty] = normalize(w - skew, 0);
    const [rx, ry] = normalize(-skew, h);
    const [bx, by] = normalize(-(w - skew), 0);
    const [lx, ly] = normalize(skew, -h);

    const TL = [skew, 0];
    const TR = [w, 0];
    const BR = [w - skew, h];
    const BL = [0, h];

    function arcCorner(cx, cy, inDx, inDy, outDx, outDy) {
        cr.lineTo(cx - r * inDx, cy - r * inDy);
        cr.curveTo(cx, cy, cx, cy, cx + r * outDx, cy + r * outDy);
    }

    cr.moveTo(TL[0] + r * tx, TL[1] + r * ty);
    cr.lineTo(TR[0] - r * tx, TR[1] - r * ty);
    arcCorner(TR[0], TR[1], tx, ty, rx, ry);
    cr.lineTo(BR[0] - r * rx, BR[1] - r * ry);
    arcCorner(BR[0], BR[1], rx, ry, bx, by);
    cr.lineTo(BL[0] - r * bx, BL[1] - r * by);
    arcCorner(BL[0], BL[1], bx, by, lx, ly);
    cr.lineTo(TL[0] - r * lx, TL[1] - r * ly);
    arcCorner(TL[0], TL[1], lx, ly, tx, ty);
    cr.closePath();
}

function drawBackground(cr, w, h, skew, isFocused, opacity) {
    cr.save();
    cr.setOperator(cairo.Operator.CLEAR);
    cr.paint();
    cr.restore();

    tracePath(cr, w, h, skew);

    const fill = isFocused ? CARD_COLORS.active.fill : CARD_COLORS.base.fill;
    cr.setSourceRGBA(fill[0], fill[1], fill[2], opacity);
    cr.fill();
}

function drawBorder(cr, w, h, skew, isFocused) {
    cr.save();
    cr.setOperator(cairo.Operator.CLEAR);
    cr.paint();
    cr.restore();

    tracePath(cr, w, h, skew);

    const border = isFocused ? CARD_COLORS.active.border : CARD_COLORS.base.border;
    const grad = new cairo.LinearGradient(0, 0, w, h);
    grad.addColorStopRGBA(0.0, border[0], border[1], border[2], isFocused ? 1.0 : 0.35);
    grad.addColorStopRGBA(0.5, border[0] * 0.7, border[1] * 0.7, border[2] * 0.7, isFocused ? 0.7 : 0.15);
    grad.addColorStopRGBA(1.0, border[0], border[1], border[2], isFocused ? 0.5 : 0.1);

    cr.setSource(grad);
    cr.setLineWidth(isFocused ? 3.0 : 1.0);
    cr.stroke();
}

function drawAppName(cr, w, h, text, textSize, textBottomPad) {
    cr.save();
    cr.setOperator(cairo.Operator.CLEAR);
    cr.paint();
    cr.restore();

    const layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);

    const fontDesc = Pango.FontDescription.from_string(`sans-serif bold ${textSize}`);
    layout.set_font_description(fontDesc);

    const [textW, textH] = layout.get_pixel_size();
    const posX = Math.round((w - textW) / 2);
    const posY = Math.round(h - textH - textBottomPad);

    cr.save();
    cr.setSourceRGBA(0, 0, 0, 0.90);
    cr.moveTo(posX + 1.0, posY + 2.0);
    PangoCairo.show_layout(cr, layout);
    cr.restore();

    cr.setSourceRGBA(1, 1, 1, 1.0);
    cr.moveTo(posX, posY);
    PangoCairo.show_layout(cr, layout);
}

function makeCard(win, app, settings) {
    const w        = settings.get_int('card-width');
    const h        = settings.get_int('card-height');
    const skew     = settings.get_int('skew');
    const textSize = settings.get_int('text-size');
    const textPad  = settings.get_int('text-bottom-pad');
    const showName = settings.get_boolean('show-app-name');

    const winBox = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: 'chakra-window-card diagonal-blade',
        width:   w,
        height:  h,
        reactive: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });

    winBox.set_pivot_point(0.5, 0.5);
    winBox.opacity = 0;
    winBox.scale_x = 0.5;
    winBox.scale_y = 0.5;

    const bgCanvas = new St.DrawingArea({ x_expand: true, y_expand: true, width: w, height: h });
    bgCanvas.connect('repaint', (area) => {
        const cr = area.get_context();
        const [sw, sh] = area.get_surface_size();
        if (!sw || !sh) { cr.$dispose(); return; }
        const opacity = settings.get_int('card-opacity') / 100;
        drawBackground(cr, sw, sh, skew, winBox.has_style_class_name('chakra-window-card-focused'), opacity);
        cr.$dispose();
    });

    settings.connect('changed::card-opacity', () => bgCanvas.queue_repaint());

    const angle  = Math.atan(-skew / h);
    const matrix = new Graphene.Matrix();
    matrix.init_skew(angle, 0);

    const clipW   = w - skew;
    const clipBin = new St.Widget({
        width: clipW,
        height: h,
        clip_to_allocation: true,
        style: 'border-radius: 18px;',
    });

    const iconWrap = new St.Bin({
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        width: clipW,
        height: h,
    });

    const rebuildIcon = () => {
        const pixels = settings.get_int('icon-size') * 25;
        const icon   = app.create_icon_texture(pixels);
        icon.opacity = Math.round(0.60 * 255);
        iconWrap.set_child(icon);
    };

    rebuildIcon();

    const iconSizeSignal = settings.connect('changed::icon-size', rebuildIcon);
    winBox.connect('destroy', () => settings.disconnect(iconSizeSignal));

    clipBin.add_child(iconWrap);
    clipBin.set_transform(matrix);
    clipBin.set_position(skew, 0);

    const transformBin = new St.Widget({ width: w, height: h });
    transformBin.add_child(clipBin);

    const borderCanvas = new St.DrawingArea({ x_expand: true, y_expand: true, width: w, height: h });
    borderCanvas.connect('repaint', (area) => {
        const cr = area.get_context();
        const [sw, sh] = area.get_surface_size();
        if (!sw || !sh) { cr.$dispose(); return; }
        drawBorder(cr, sw, sh, skew, winBox.has_style_class_name('chakra-window-card-focused'));
        cr.$dispose();
    });

    const appName   = app.get_name() || win.get_title() || '';
    const textCanvas = new St.DrawingArea({ width: clipW, height: h });
    textCanvas.connect('repaint', (area) => {
        const cr = area.get_context();
        const [sw, sh] = area.get_surface_size();
        if (!sw || !sh) { cr.$dispose(); return; }
        drawAppName(cr, sw, sh, appName, textSize, textPad);
        cr.$dispose();
    });

    textCanvas.set_transform(matrix);
    textCanvas.set_position(skew, 0);

    const textWrapper = new St.Widget({ width: w, height: h });
    textWrapper.add_child(textCanvas);
    textWrapper.opacity = 0;

    winBox.connect('style-changed', () => {
        bgCanvas.queue_repaint();
        borderCanvas.queue_repaint();

        if (!showName) return;

        const isFocused = winBox.has_style_class_name('chakra-window-card-focused');
        textWrapper.ease({
            opacity: isFocused ? 255 : 0,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    });

    winBox.add_child(bgCanvas);
    winBox.add_child(transformBin);
    winBox.add_child(borderCanvas);
    winBox.add_child(textWrapper);

    return winBox;
}

export function buildLayout(container, windows, monitor, settings, onCardClick) {
    const N = windows.length;
    if (N === 0) return { cards: [], center: { x: 0, y: 0 }, disableHover: false };

    const yOffsetPct = settings.get_int('y-offset') / 100;
    const cardWidth  = settings.get_int('card-width');
    const cardHeight = settings.get_int('card-height');
    const gap        = settings.get_int('card-gap');

    const center = {
        x: monitor.x + Math.round(monitor.width  / 2),
        y: monitor.y + Math.round(monitor.height / 2) + Math.round(monitor.height * yOffsetPct),
    };

    const cards = new Array(N);

    for (let i = 0; i < N; i++) {
        const { win, app } = windows[i];
        const winBox = makeCard(win, app, settings);

        winBox.connect('button-press-event', () => {
            onCardClick(win);
            return Clutter.EVENT_STOP;
        });

        container.add_child(winBox);
        cards[i] = { actor: winBox, window: win, appName: app.get_name() || win.get_title() || '' };
    }

    if (N <= 5) {
        const rawDists = new Array(N);
        let minD = Infinity, maxD = -Infinity;

        for (let i = 0; i < N; i++) {
            rawDists[i] = i - N/2;
            if (rawDists[i] < minD) minD = rawDists[i];
            if (rawDists[i] > maxD) maxD = rawDists[i];
        }

        const midOffset = (minD + maxD) / 2;

        for (let i = 0; i < N; i++) {
            const adjusted = rawDists[i] - midOffset;
            const posX = center.x - (cardWidth / 2) + (adjusted * gap);
            const posY = center.y - (cardHeight / 2);
            cards[i].actor._targetX    = posX;
            cards[i].actor._targetY    = posY;
            cards[i].actor._baseScale  = 1.0;
            cards[i].actor._baseOpacity = 255;
            cards[i].actor.set_position(posX, posY);
        }

        function updateStaticPositions(cardsArray, selectedIndex, layoutCenter, layoutContainer) {
            const total = cardsArray.length;
            if (total === 0) return;

            const renderOrder = [];
            for (let i = 0; i < total; i++) {
                const card = cardsArray[i];
                if (!card || !card.actor) continue;
                let dist = i - selectedIndex;
                if (dist > total / 2)      dist -= total;
                else if (dist < -total / 2) dist += total;
                renderOrder.push({ actor: card.actor, absDist: Math.abs(dist) });
            }

            if (layoutContainer) {
                renderOrder.sort((a, b) => b.absDist - a.absDist);
                for (const item of renderOrder) {
                    layoutContainer.set_child_above_sibling(item.actor, null);
                }
            }
        }

        updateStaticPositions(cards, 0, center, container);
        return { cards, center, updateLayout: updateStaticPositions, disableHover: false };
    }

    function updateScrollPositions(cardsArray, selectedIndex, layoutCenter, layoutContainer) {
        const total = cardsArray.length;
        if (total === 0) return;

        const renderOrder = [];

        for (let i = 0; i < total; i++) {
            const card = cardsArray[i];
            if (!card || !card.actor) continue;

            let dist = i - selectedIndex;
            if (dist > total / 2)      dist -= total;
            else if (dist < -total / 2) dist += total;

            const absDist = Math.abs(dist);
            let opacity = 255, scale = 1.0;

            if      (absDist === 0) { opacity = 255; scale = 1.0;  }
            else if (absDist === 1) { opacity = 255; scale = 1.0;  }
            else if (absDist === 2) { opacity = 230; scale = 0.90; }
            else if (absDist === 3) { opacity = 100; scale = 0.80; }
            else {
                opacity = 0;
                scale   = 0.75;
                const sign = dist > 0 ? 1 : -1;
                dist = sign * 3.5;
            }

            card.actor._targetX     = layoutCenter.x - (cardWidth / 2) + (dist * gap);
            card.actor._targetY     = layoutCenter.y - (cardHeight / 2);
            card.actor._baseScale   = scale;
            card.actor._baseOpacity = opacity;

            renderOrder.push({ actor: card.actor, absDist });
        }

        if (layoutContainer) {
            renderOrder.sort((a, b) => b.absDist - a.absDist);
            for (const item of renderOrder) {
                layoutContainer.set_child_above_sibling(item.actor, null);
            }
        }
    }

    updateScrollPositions(cards, 0, center, container);
    for (const card of cards) {
        card.actor.set_position(card.actor._targetX, card.actor._targetY);
    }

    return { cards, center, updateLayout: updateScrollPositions, disableHover: true };
}