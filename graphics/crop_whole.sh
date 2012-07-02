#!/bin/bash

gifsicle --transform-colormap 'cat lights_off.palette' simon_on.gif > simon_off.gif

for x in off on; do
  convert simon_$x.gif -crop 96x64+96+0 +repage simon_0_$x.gif
  convert simon_$x.gif -crop 96x128+96+64 +repage simon_1_$x.gif
  convert simon_$x.gif -crop 96x128+0+64 +repage simon_2_$x.gif
  convert simon_$x.gif -crop 96x64+0+0 +repage simon_3_$x.gif
done

for x in 0 1 2 3; do
  convert -delay 100 simon_${x}_off.gif simon_${x}_on.gif simon_$x.gif
done
