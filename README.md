# LDR and thermistor

Interactive potential-divider simulation with two screens (tabs, or the
links `#ldr` and `#thermistor`):

- **LDR**: a lamp shines on an LDR wired in series with a fixed resistor.
- **Thermistor**: a thermistor sits in a beaker of water on a hot plate,
  wired in series with a fixed resistor.

On each screen a voltmeter reads the sensor's share of the battery's
voltage and an ammeter reads the current.

- Light level, battery voltage and fixed resistor are adjustable.
- The resistance–light-intensity graph tracks the LDR's current value.
- The current animation overlay is the one from `uses-of-electromagnets`
  (red 5/7 dashes over the wires); here its speed and brightness follow
  the current.
- "Click here for theory" opens the theory panel; the corner button goes
  full screen (Esc leaves either).

## Run

```sh
npm install
npm run dev
```

`vite.config.js` sets `base: "/LDR/"` for GitHub Pages; change it if the
repo is named differently.
