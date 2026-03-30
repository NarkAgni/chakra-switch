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


import Clutter from 'gi://Clutter';


export function playEntrySequence(cardsArray, selectedIndex, settings) {
    const N = cardsArray.length;
    if (N === 0) return;

    const staggerGap = settings.get_int('stagger-gap-ms');
    const duration   = settings.get_int('ease-duration-ms');

    for (let i = 0; i < N; i++) {
        const card = cardsArray[i];
        if (!card || !card.actor) continue;

        const baseScale   = card.actor._baseScale   || 1.0;
        const baseOpacity = card.actor._baseOpacity !== undefined ? card.actor._baseOpacity : 255;

        let dist = i - selectedIndex;
        if (dist > N / 2)      dist -= N;
        else if (dist < -N / 2) dist += N;

        const delay       = Math.abs(dist) * staggerGap;
        const targetScale = i === selectedIndex ? baseScale * 1.2 : baseScale;

        card.actor.opacity = 0;
        card.actor.scale_x = 0.5;
        card.actor.scale_y = 0.5;

        card.actor.ease({
            opacity: i === selectedIndex ? 255 : baseOpacity,
            scale_x: targetScale,
            scale_y: targetScale,
            delay,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUINT,
        });
    }
}