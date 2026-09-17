# Production procedural land-biome boundary

The Gobi, Kayenta floodplain and Carboniferous wetland presets are production
pure-data modules. Each target animal dynamically imports only its selected
preset and loads that theme's ground/depth package; the other two packages are
not requested.

The renderer does not treat a generated landscape plate as walkable ground.
The 4K/2K equirectangular plate supplies distant composition and atmospheric
radiance. Readable basin ridges, terrain, riverbanks, water, scanned props and
vegetation are depth-writing world-space geometry, so their sharpness and
parallax do not depend on panorama resolution.

The Kayenta theme uses a terrain-cut, meandering seasonal reach with integrated
wet-mud banks. The Carboniferous theme uses separate irregular peat pools
instead of an engineered-looking straight canal. Both share a moving
procedural water-normal field, and their selected-theme terrain mesh has enough
world-space resolution to resolve the banks without exposing triangular water
fragments. The Gobi ground uses synchronized stochastic sampling for albedo,
normal and roughness instead of repeating its two-metre scan as a visible
square grid.

The Gobi treatment follows the Iren Dabasu evidence for a braided fluvial
system with a broad vegetated floodplain and temporary ponds, not an empty dune
desert. The Kayenta treatment combines reddish sediment, seasonal channels and
riparian conifer depth, including fixed crossed world-space profiles in the
far colonies rather than a landscape plate. The Carboniferous treatment is
built from sparse emergent lycopsids, calamite/sphenopsid and three overlapping
supported tree-fern depth bands. It deliberately contains no modern flowering
broadleaf canopy.

Scientific source URLs live beside each preset. Generated plates, scanned
ecology and atlas sources are recorded in the repository runtime provenance.
Borrowed cache textures are detached before ordinary scene-graph disposal;
locally generated water normals, geometry and materials are disposed with the
active environment.
