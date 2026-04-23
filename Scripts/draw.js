let activeColors = [];

  const colorMap = {
    red: [255, 80, 80],
    blue: [80, 120, 255],
    green: [20, 250, 50]
  };

  // button event listener -> trigger color change
  document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const color = btn.dataset.color;

      if (activeColors.includes(color)) {
        activeColors = activeColors.filter(c => c !== color);
        btn.classList.remove("active");
      } else {
        activeColors.push(color);
        btn.classList.add("active");
      }
    });
  });

  // P5 canvas set up
  new p5(p => {
    let t = 0;

    p.setup = function () {
      let canvas = p.createCanvas(400, 400);
      canvas.parent("canvas-container");
      p.clear();
      p.noStroke();
      p.fill(255, 255, 255, 40);
      p.ellipse(-40, -40, 80, 80);
    };

    p.draw = function () {
      p.clear();

      p.translate(p.width / 2, p.height / 2);

      let radius = 150;

      // To get the flowing effect, drawing canvas pixel by pixel
      for (let x = -radius; x < radius; x++) {
        for (let y = -radius; y < radius; y++) {
          let d = Math.sqrt(x * x + y * y);

          if (d < radius) {
            let nx = x * 0.01;
            let ny = y * 0.01;

            let noiseVal = p.noise(nx + t, ny + t);

            let col = getBlendedColor(noiseVal);

            let alpha = p.map(d, radius - 20, radius, 255, 0);
            alpha = p.constrain(alpha, 0, 255);

        
            let light = p.map(d, 0, radius, 1, 0.2); // mimic 3D 

            p.fill(col[0] * light, col[1] * light, col[2] * light, alpha);
            
            p.rect(x, y, 1, 1);
          }
        }
      }

      t += 0.03;
    };

    function getBlendedColor(n) {
      if (activeColors.length === 0) {
        return [120, 120, 120]; // color for when no product is selected
      }

      if (activeColors.length === 1) {
        return colorMap[activeColors[0]];
      }

      // Blend colors using lerp
      let scaled = n * (activeColors.length - 1);
      let i = Math.floor(scaled);
      let frac = scaled - i;

      let c1 = colorMap[activeColors[i]];
      let c2 = colorMap[activeColors[i + 1]];

      return [
        p.lerp(c1[0], c2[0], frac),
        p.lerp(c1[1], c2[1], frac),
        p.lerp(c1[2], c2[2], frac)
      ];
    }
  });