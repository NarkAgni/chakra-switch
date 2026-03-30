<div align="center">
  <img src="icon/logo.svg" alt="Chakra Switch Logo" width="128" height="128">
  <h1>Chakra Switch</h1>
  <p><strong>A modern visual Alt+Tab replacement for GNOME Shell</strong></p>
  <p>Developed by <strong>Narkagni</strong></p>
</div>

<hr>

<h2>Overview</h2>
<p>
  Chakra Switch replaces the default GNOME Alt+Tab with a sleek diagonal blade card switcher
  Each open window is represented as a stylized skewed card with a live icon watermark smooth entry animations and an optional peek preview that shows the actual window behind the overlay
  Everything is configurable through a native LibAdwaita preferences window.
</p>

<h2>Gallery</h2>
<p>
  <strong>The Switcher & Preferences:</strong> Minimal design with deep customization
</p>
<div align="center">
  <img src="media/chakra.png" alt="Chakra Switch Interface" width="100%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 10px;">
  <img src="media/prefs.png" alt="Preferences Window" width="100%" style="border-radius: 8px; border: 1px solid #333;">
</div>

<hr>

<h2>Key Features</h2>

<details>
  <summary><strong>Diagonal Blade Layout</strong></summary>
  <p>
    Open windows are displayed as parallelogram shaped cards arranged in a horizontal row
    The focused card is highlighted with a red border and scales up slightly
    With more than 5 windows the layout becomes a scrollable carousel only the nearest cards are visible
  </p>
</details>

<details>
  <summary><strong>Live Peek Preview</strong></summary>
  <p>
    When a card is focused the actual window content appears as a scaled down live clone
    centered behind the switcher All other windows fade out so the preview is always clean
    Peek can be toggled and fully tuned (opacity, scale, animation speed) in preferences
  </p>
</details>

<details>
  <summary><strong>Smooth Animations</strong></summary>
  <p>
    Cards animate in from the center outward the focused card arrives first flanking cards
    follow with a configurable stagger delay Focus transitions are fluid with independent
    duration and scale controls
  </p>
</details>

<details>
  <summary><strong>Deep Customization</strong></summary>
  <p>
    Nearly every visual parameter is exposed in the preferences window with live reset buttons
  </p>
  <ul>
    <li><strong>Card:</strong> Width, height, gap, skew angle, background opacity</li>
    <li><strong>Icon:</strong> Size multiplier for the watermark icon inside each card</li>
    <li><strong>App Label:</strong> Toggle, font size, and bottom padding of the focused app name</li>
    <li><strong>Animation:</strong> Entry stagger delay, entry duration, focus duration, focus scale</li>
    <li><strong>Peek Preview:</strong> Enable/disable, max scale, opacity, fade-in and fade-out speed</li>
  </ul>
</details>

<hr>

<h2>Installation</h2>

<h3>Requirements</h3>
<ul>
  <li>GNOME Shell 45 - 50</li>
  <li><code>libglib2.0-bin</code> (required for schema compilation)</li>
</ul>

<h3>Install from Source</h3>

<p><strong>1. Clone the repository</strong></p>
<pre>git clone https://github.com/NarkAgni/chakra-switch.git
cd chakra-switch</pre>

<p><strong>2. Install using Make</strong></p>
<pre>make install</pre>

<p><strong>3. Restart GNOME Shell</strong></p>
<p>
  For <strong>X11</strong>: Press <code>Alt+F2</code>, type <code>r</code>, and hit Enter.<br>
  For <strong>Wayland</strong>: Log out and log back in.
</p>

<p><strong>4. Enable the extension</strong></p>
<pre>gnome-extensions enable chakra-switch@narkagni</pre>

<p><strong>To uninstall:</strong></p>
<pre>make uninstall</pre>

<hr>

<h2>Usage</h2>

<ul>
  <li><strong>Open Switcher:</strong> <code>Alt+Tab</code></li>
  <li><strong>Cycle Forward:</strong> <code>Alt+Tab</code> / <code>→</code> / <code>↓</code></li>
  <li><strong>Cycle Backward:</strong> <code>Alt+Shift+Tab</code> / <code>←</code> / <code>↑</code></li>
  <li><strong>Activate Window:</strong> Release <code>Alt</code> or click a card</li>
  <li><strong>Scroll:</strong> Mouse wheel cycles through cards (carousel mode)</li>
</ul>

<hr>

<h2>Support Development</h2>
<p>
  This extension is free and open source If Chakra Switch improves your workflow, consider supporting the development
</p>

<div align="center">
  <a href="https://github.com/sponsors/NarkAgni">
    <img src="https://img.shields.io/badge/❤️_Sponsor-NarkAgni-EA4AAA?style=for-the-badge&logo=github&logoColor=white" height="40">
  </a>
  &nbsp;&nbsp;
  <a href="https://buymeacoffee.com/narkagni">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
  </a>
</div>

<br>

<details>
  <summary><strong>Crypto Addresses</strong></summary>
  <br>
  <p><strong>Bitcoin (BTC):</strong></p>
  <pre>1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV</pre>

  <p><strong>Ethereum (ETH):</strong></p>
  <pre>0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3</pre>

  <p><strong>Tether (USDT - TRC20):</strong></p>
  <pre>THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82</pre>
</details>

<hr>

<p align="center">License: GPL-3.0</p>