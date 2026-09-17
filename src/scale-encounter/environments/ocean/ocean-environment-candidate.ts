import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataUtils,
  DataTexture,
  DirectionalLight,
  Fog,
  Group,
  HalfFloatType,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LinearSRGBColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
} from 'three'
import {
  OCEAN_WATER_SURFACE_Y,
  OCEAN_WATER_VOLUME_BOUNDS,
  OCEAN_WORLD_RADIUS,
  diagnoseOceanSpatialContract,
  oceanBedYAt,
  type OceanGroundedPlacement,
  type OceanObservationContext,
  type OceanSpatialDiagnostics,
} from './ocean-spatial-contract'

export type OceanEnvironmentVariant = 'A' | 'B' | 'C' | 'D'

export type OceanEnvironmentLayer =
  | 'background-scatter'
  | 'water-surface'
  | 'water-volume'
  | 'seabed'
  | 'near-water'
  | 'mid-water'
  | 'far-volume'
  | 'caustics'
  | 'suspended-particulate'
  | 'ecology-clues'

export const OCEAN_ENVIRONMENT_VARIANTS = [
  'A',
  'B',
  'C',
  'D',
] as const satisfies readonly OceanEnvironmentVariant[]

export const OCEAN_ENVIRONMENT_LAYERS = [
  'background-scatter',
  'water-surface',
  'water-volume',
  'seabed',
  'near-water',
  'mid-water',
  'far-volume',
  'caustics',
  'suspended-particulate',
  'ecology-clues',
] as const satisfies readonly OceanEnvironmentLayer[]

export interface OceanSeabedTextureLease {
  readonly albedo: Texture
  readonly decodedByteEstimate: number
  readonly normal: Texture
  readonly physicalWidthMeters: number
  readonly roughness: Texture
}

export interface OceanBackdropTextureLease {
  readonly aspectRatio: number
  readonly decodedByteEstimate: number
  readonly texture: Texture
}

export interface ApprovedOceanEcologyClue {
  readonly id: string
  readonly object: Object3D
  readonly status: 'approved-for-ocean-slice'
}

export interface CreateOceanEnvironmentCandidateOptions {
  readonly approvedEcologyClues?: readonly ApprovedOceanEcologyClue[]
  readonly backdropTexture?: OceanBackdropTextureLease | null
  readonly debug?: boolean
  readonly seabedTextures?: OceanSeabedTextureLease | null
  readonly variant: OceanEnvironmentVariant
}

export interface OceanResourceDiagnostics {
  readonly drawCalls: number
  readonly estimatedDecodedTextureBytes: number
  readonly geometries: number
  readonly instances: number
  readonly materials: number
  readonly objects: number
  readonly opaqueDrawCalls: number
  readonly textures: number
  readonly transparentDrawCalls: number
  readonly transparentMaterialCount: number
  readonly transparentScreenCoverageEstimate: number
  readonly triangles: number
}

export interface OceanEnvironmentDiagnostics {
  readonly alpha: {
    readonly cardCount: number
    readonly depthWriteDisabledDraws: number
    readonly repeatedCardGroups: number
  }
  readonly approvedEcologyAssetIds: readonly string[]
  readonly browserIndependentDesignChecks: {
    readonly colourDiscontinuityBands: number
    readonly ecologyFallbackReason: string | null
    readonly repeatedFarCards: number
  }
  readonly fogDensity: number
  readonly fogFar: number | null
  readonly fogModel: 'linear-depth' | 'none'
  readonly fogNear: number | null
  readonly naturalnessRevision: string
  readonly layers: Readonly<Record<OceanEnvironmentLayer, boolean>>
  readonly resources: OceanResourceDiagnostics
  readonly spatial: OceanSpatialDiagnostics | null
  readonly variant: OceanEnvironmentVariant
  readonly world: {
    readonly metresPerUnit: 1
    readonly toneMapping: 'ACESFilmicToneMapping'
    readonly upAxis: '+Y'
    readonly waterSurfaceY: number
    readonly waterSurfaceDisplacementMeters: number
  }
}

export interface OceanEnvironmentCandidate {
  readonly radianceTexture: DataTexture
  readonly root: Group
  readonly toneMapping: typeof ACESFilmicToneMapping
  dispose(): void
  getDiagnostics(): OceanEnvironmentDiagnostics
  getFog(): Fog | null
  setDebugVisible(visible: boolean): void
  setLayerEnabled(layer: OceanEnvironmentLayer, enabled: boolean): void
  setObservationContext(context: OceanObservationContext): void
  setVariant(variant: OceanEnvironmentVariant): void
  update(
    elapsedSeconds: number,
    camera: Camera,
    viewport?: { readonly height: number; readonly width: number },
  ): void
}

const layerDefaults: Readonly<
  Record<OceanEnvironmentVariant, ReadonlySet<OceanEnvironmentLayer>>
> = {
  A: new Set(['background-scatter']),
  B: new Set([
    'background-scatter',
    'water-surface',
    'water-volume',
    'caustics',
  ]),
  C: new Set([
    'background-scatter',
    'water-surface',
    'water-volume',
    'near-water',
    'mid-water',
    'far-volume',
    'caustics',
    'suspended-particulate',
  ]),
  D: new Set([
    'background-scatter',
    'water-surface',
    'water-volume',
    'near-water',
    'mid-water',
    'far-volume',
    'caustics',
    'suspended-particulate',
  ]),
}

export const OCEAN_FORMAL_REVIEW_BUILD_ID =
  'ocean-formal-review-gallery-blue-clear-water-v14' as const
export const OCEAN_NATURALNESS_REVISION =
  'clear-sunlit-surface-scatter-v12' as const
export const OCEAN_COHERENT_RADIANCE_REVISION =
  'coherent-gallery-blue-clear-water-v4' as const
export const OCEAN_SURFACE_DISPLACEMENT_METERS = 0.16

export const OCEAN_GALLERY_WATER_PALETTE = {
  deep: '#075b91',
  horizon: '#258bb9',
  sun: '#f4e5c6',
  surface: '#68b8d1',
} as const

const OCEAN_CURRENT_DIRECTION_XZ = new Vector2(0.86, -0.51).normalize()
const OCEAN_CURRENT_WRAP_METERS = 5.6
const OCEAN_MOTE_CURRENT_SPEED_METERS_PER_SECOND = 0.045
const OCEAN_BUBBLE_CURRENT_SPEED_METERS_PER_SECOND = 0.11

const OCEAN_FOG_COLOUR = '#1d7596'
const OCEAN_FOG_NEAR_BY_VARIANT: Readonly<
  Record<Exclude<OceanEnvironmentVariant, 'A'>, number>
> = { B: 190, C: 180, D: 82 }
const OCEAN_FOG_FAR_BY_VARIANT: Readonly<
  Record<Exclude<OceanEnvironmentVariant, 'A'>, number>
> = { B: 560, C: 540, D: 310 }
// A refracted-sun direction close to water's ca. 48.6 degree critical cone:
// high enough to read as surface light, while its azimuth remains visible in
// the shallow upward overview camera.
const OCEAN_SUN_DIRECTION = new Vector3(-0.25, 0.68, -0.69).normalize()

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalised = clamp01((value - edge0) / (edge1 - edge0))
  return normalised * normalised * (3 - 2 * normalised)
}

function mixNumber(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

/**
 * D bakes the static open-water radiance once. Background, water reflection
 * and PMREM all sample this exact linear HDR texture instead of maintaining
 * three visually similar but directionally different suns.
 */
function createOceanRadianceLut(): DataTexture {
  const width = 256
  const height = 128
  const data = new Uint16Array(width * height * 4)
  const deep = new Color(OCEAN_GALLERY_WATER_PALETTE.deep)
  const horizon = new Color(OCEAN_GALLERY_WATER_PALETTE.horizon)
  const surface = new Color(OCEAN_GALLERY_WATER_PALETTE.surface)
  const sun = new Color(OCEAN_GALLERY_WATER_PALETTE.sun)
  const direction = new Vector3()

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    const elevationAngle = (v - 0.5) * Math.PI
    const elevation = Math.sin(elevationAngle)
    const horizontalLength = Math.cos(elevationAngle)
    const horizonMix = smoothstep(-0.72, 0.08, elevation)
    const surfaceMix = smoothstep(0.02, 0.88, elevation)

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width
      const azimuth = (u - 0.5) * Math.PI * 2
      direction.set(
        Math.cos(azimuth) * horizontalLength,
        elevation,
        Math.sin(azimuth) * horizontalLength,
      )

      const base: [number, number, number] = [
        mixNumber(deep.r, horizon.r, horizonMix),
        mixNumber(deep.g, horizon.g, horizonMix),
        mixNumber(deep.b, horizon.b, horizonMix),
      ]
      base[0] = mixNumber(base[0], surface.r, surfaceMix)
      base[1] = mixNumber(base[1], surface.g, surfaceMix)
      base[2] = mixNumber(base[2], surface.b, surfaceMix)

      const broadDensity =
        0.5 +
        Math.sin(azimuth * 3.1 + elevation * 4.7) * 0.16 +
        Math.sin(azimuth * 8.2 - elevation * 2.3 + 1.7) * 0.08
      const densityScale = 0.982 + broadDensity * 0.034
      const sunCosine = Math.max(0, direction.dot(OCEAN_SUN_DIRECTION))
      const halo = Math.pow(sunCosine, 15) * 0.2
      const core = Math.pow(sunCosine, 190) * 0.68
      const upward = smoothstep(-0.02, 0.66, elevation)
      const sunAmount = (halo + core) * upward
      const offset = (y * width + x) * 4

      data[offset] = DataUtils.toHalfFloat(
        base[0] * densityScale + sun.r * sunAmount,
      )
      data[offset + 1] = DataUtils.toHalfFloat(
        base[1] * densityScale + sun.g * sunAmount,
      )
      data[offset + 2] = DataUtils.toHalfFloat(
        base[2] * densityScale + sun.b * sunAmount,
      )
      data[offset + 3] = DataUtils.toHalfFloat(1)
    }
  }

  const texture = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    HalfFloatType,
  )
  texture.name = 'ocean-coherent-radiance-linear-hdr-v1'
  texture.colorSpace = LinearSRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const OCEAN_NOISE_GLSL = /* glsl */ `
  float oceanHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float oceanValueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    float a = oceanHash21(cell);
    float b = oceanHash21(cell + vec2(1.0, 0.0));
    float c = oceanHash21(cell + vec2(0.0, 1.0));
    float d = oceanHash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float oceanFbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 4; octave += 1) {
      total += oceanValueNoise(p) * amplitude;
      p = rotation * p * 2.03 + vec2(7.1, -4.3);
      amplitude *= 0.5;
    }
    return total;
  }
`

const OCEAN_RADIANCE_GLSL = /* glsl */ `
  vec2 oceanDirectionToEquirectUv(vec3 direction) {
    direction = normalize(direction);
    return vec2(
      atan(direction.z, direction.x) * 0.15915494309189535 + 0.5,
      asin(clamp(direction.y, -1.0, 1.0)) * 0.3183098861837907 + 0.5
    );
  }

  float oceanForwardPhase(float cosineTheta) {
    const float anisotropy = 0.56;
    float denominator = 1.0 + anisotropy * anisotropy -
      2.0 * anisotropy * cosineTheta;
    return (1.0 - anisotropy * anisotropy) /
      max(0.08, pow(denominator, 1.5));
  }

  float oceanAngularDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
  }

  // One soft volume lobe projected from a moving surface opening. Different
  // offsets and spreads form a divergent fan rather than repeated parallel
  // stripes. The low-frequency FBM moves the transmitted energy, while the
  // centre itself only wanders slightly so the sun never appears to wobble.
  float oceanDynamicSunShaft(
    float azimuth,
    float elevation,
    float depth,
    float openingOffset,
    float divergence,
    float phase,
    float widthScale
  ) {
    float sunAzimuth = atan(uSunDirection.z, uSunDirection.x) *
      0.15915494309189535;
    float centreWander = sin(uTime * 0.23 + phase) * 0.012;
    float centre = sunAzimuth + openingOffset +
      divergence * depth + centreWander;
    float width = mix(0.048, 0.126, depth) * widthScale;
    float distanceToCentre = oceanAngularDistance(azimuth, centre);
    float lobe = exp(
      -0.5 * distanceToCentre * distanceToCentre /
      max(0.00008, width * width)
    );
    float surfaceFlow = oceanFbm(
      vec2(
        azimuth * 12.0 + elevation * 2.4 + phase,
        elevation * 4.2 - uTime * 0.092 + phase * 0.37
      )
    );
    float transmission = mix(
      0.18,
      1.32,
      smoothstep(0.24, 0.72, surfaceFlow)
    );
    float slowPulse = 0.80 + sin(uTime * 0.44 + phase) * 0.20;
    return lobe * transmission * slowPulse;
  }

  float oceanIntegratedSurfaceScatter(vec3 direction) {
    float jitter = oceanHash21(direction.xy * 913.7 + direction.yz * 271.3);
    float accumulated = 0.0;
    float accumulatedWeight = 0.0;
    mat2 surfaceRotation = mat2(0.78, -0.63, 0.63, 0.78);
    for (int sampleIndex = 0; sampleIndex < 6; sampleIndex += 1) {
      float distanceAlongRay = 7.0 +
        (float(sampleIndex) + jitter * 0.72) * 11.5;
      vec3 samplePosition = cameraPosition + direction * distanceAlongRay;
      float belowSurface = 1.0 - step(uWaterSurfaceY, samplePosition.y);
      float distanceToSurface = max(
        0.0,
        (uWaterSurfaceY - samplePosition.y) / max(0.12, uSunDirection.y)
      );
      vec2 surfaceHit = samplePosition.xz +
        uSunDirection.xz * distanceToSurface;
      float waveA = oceanValueNoise(
        surfaceHit * 0.052 + vec2(uTime * 0.024, -uTime * 0.017)
      );
      float waveB = oceanValueNoise(
        surfaceRotation * surfaceHit * 0.113 +
        vec2(-uTime * 0.015, uTime * 0.021)
      );
      float transmission = smoothstep(0.22, 0.82, waveA * 0.58 + waveB * 0.42);
      float opening = 1.0 - smoothstep(
        7.0,
        38.0,
        length(surfaceHit - uSunOpeningCentre)
      );
      transmission = mix(transmission, 0.94, opening * 0.66);
      float distanceWeight = exp(-distanceAlongRay * 0.021) * belowSurface;
      accumulated += transmission * distanceWeight;
      accumulatedWeight += distanceWeight;
    }
    return accumulated / max(0.001, accumulatedWeight);
  }

  vec3 oceanFarRadiance(vec3 direction) {
    direction = normalize(direction);
    if (uUseRadianceLut > 0.5) {
      vec2 radianceUv = oceanDirectionToEquirectUv(direction);
      vec3 cachedRadiance = texture2D(uRadianceLut, radianceUv).rgb;
      // One low-frequency modulation retains a gentle living-water drift while
      // skipping the six-sample integration and multi-octave shaft field.
      float slowWaterBreath = oceanValueNoise(
        radianceUv * vec2(7.0, 3.4) + vec2(uTime * 0.004, -uTime * 0.0025)
      );
      return cachedRadiance * mix(0.985, 1.018, slowWaterBreath);
    }
    float elevation = direction.y;
    float horizonMix = smoothstep(-0.72, 0.08, elevation);
    float surfaceMix = smoothstep(0.02, 0.88, elevation);
    vec3 colour = mix(uDeepColour, uHorizonColour, horizonMix);
    colour = mix(colour, uSurfaceColour, surfaceMix);

    float azimuth = atan(direction.z, direction.x) * 0.15915494309189535;
    vec2 volumeCoordinate = vec2(azimuth * 3.2, elevation * 1.8);
    float broadDensity = oceanFbm(
      volumeCoordinate + vec2(uTime * 0.0021, -uTime * 0.0014)
    );
    colour *= 0.965 + broadDensity * 0.055;

    float upwardMask = smoothstep(-0.02, 0.66, elevation);
    vec2 surfaceCoordinate = direction.xz / max(0.12, elevation + 0.08);
    float surfaceTransmission = oceanFbm(
      surfaceCoordinate * 0.34 + vec2(uTime * 0.024, -uTime * 0.017)
    );
    colour += uSurfaceColour * upwardMask *
      (0.024 + surfaceTransmission * 0.045);

    float sunCosine = max(dot(direction, uSunDirection), 0.0);
    float forwardScatter = oceanForwardPhase(sunCosine);
    float halo = pow(sunCosine, 15.0);
    float sunCore = pow(sunCosine, 190.0);
    float waveShadow = mix(0.88, 1.06, surfaceTransmission);
    float integratedSurfaceScatter = oceanIntegratedSurfaceScatter(direction);
    float shaftVisibility = 1.0 - smoothstep(0.28, 0.82, -elevation);
    // The camera often looks almost horizontally across the animal/child
    // corridor. Real forward-scattered surface light remains visible there;
    // limiting it to the upward hemisphere made the former version read as a
    // flat bright ceiling. Each view ray is sampled at several depths and
    // projected back to the animated surface, so these softly broken patches
    // share one sun direction without becoming parallel screen-space cards.
    float shaftAltitude = smoothstep(-0.54, 0.34, elevation);
    float shaftOpening = smoothstep(0.18, 0.58, integratedSurfaceScatter);
    float shaftWarp = oceanFbm(
      volumeCoordinate * vec2(3.8, 2.6) +
      vec2(-uTime * 0.0022, uTime * 0.0017)
    );
    float shaftApertures = oceanFbm(
      vec2(
        azimuth * 19.0 + elevation * 2.8 + shaftWarp * 1.7,
        elevation * 2.2 - azimuth * 1.3
      ) + vec2(uTime * 0.0018, -uTime * 0.0012)
    );
    float shaftBreakup = mix(
      0.24,
      1.22,
      smoothstep(0.37, 0.69, shaftApertures)
    );
    float broadShaftCone = pow(sunCosine, 2.15);
    float shaftTransmission = mix(0.34, 1.0, shaftOpening);
    float shaftDepth = clamp((0.58 - elevation) / 1.05, 0.0, 1.0);
    float animatedShafts = 0.0;
    animatedShafts += oceanDynamicSunShaft(
      azimuth, elevation, shaftDepth, -0.085, -0.040, 0.3, 1.08
    );
    animatedShafts += oceanDynamicSunShaft(
      azimuth, elevation, shaftDepth, -0.018, -0.012, 1.8, 1.18
    );
    animatedShafts += oceanDynamicSunShaft(
      azimuth, elevation, shaftDepth, 0.054, 0.026, 3.4, 1.12
    );
    animatedShafts = 1.0 - exp(-animatedShafts * 0.54);
    float animatedShaftVisibility = smoothstep(-0.58, 0.28, elevation) *
      (1.0 - smoothstep(0.86, 1.0, shaftDepth));
    colour += uSunColour * forwardScatter * upwardMask * waveShadow * 0.032;
    colour += uSunColour * halo * upwardMask * waveShadow * 0.21;
    colour += uSunColour * sunCore * upwardMask * 0.62;
    colour += uSunColour * integratedSurfaceScatter * forwardScatter *
      shaftVisibility * 0.042;
    colour += uSunColour * shaftTransmission * shaftAltitude * shaftVisibility *
      shaftBreakup * broadShaftCone *
      (0.082 + min(forwardScatter, 2.4) * 0.025);
    colour += uSunColour * animatedShafts * animatedShaftVisibility *
      (0.084 + min(forwardScatter, 2.4) * 0.024);

    vec3 approvedBackdrop = texture2D(
      uBackdrop,
      oceanDirectionToEquirectUv(direction)
    ).rgb;
    return mix(colour, approvedBackdrop, uUseBackdrop * 0.86);
  }
`

function createOceanRadianceUniforms(
  lease: OceanBackdropTextureLease | null,
  radianceTexture: DataTexture,
): Record<string, { value: unknown }> {
  return {
    uBackdrop: { value: lease?.texture ?? null },
    uDeepColour: { value: new Color(OCEAN_GALLERY_WATER_PALETTE.deep) },
    uHorizonColour: { value: new Color(OCEAN_GALLERY_WATER_PALETTE.horizon) },
    uRadianceLut: { value: radianceTexture },
    uSunColour: { value: new Color(OCEAN_GALLERY_WATER_PALETTE.sun) },
    uSunDirection: { value: OCEAN_SUN_DIRECTION.clone() },
    uSunOpeningCentre: { value: new Vector2(-17, -24) },
    uSurfaceColour: { value: new Color(OCEAN_GALLERY_WATER_PALETTE.surface) },
    uTime: { value: 0 },
    uUseBackdrop: { value: lease ? 1 : 0 },
    uUseRadianceLut: { value: 0 },
    uWaterSurfaceY: { value: OCEAN_WATER_SURFACE_Y },
  }
}

function createBackdropMaterial(
  lease: OceanBackdropTextureLease | null,
  radianceTexture: DataTexture,
): ShaderMaterial {
  return new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    side: BackSide,
    toneMapped: true,
    uniforms: createOceanRadianceUniforms(lease, radianceTexture),
    vertexShader: /* glsl */ `
      varying vec3 vViewDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vViewDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vViewDirection;
      uniform sampler2D uBackdrop;
      uniform sampler2D uRadianceLut;
      uniform vec3 uDeepColour;
      uniform vec3 uHorizonColour;
      uniform vec3 uSunColour;
      uniform vec3 uSunDirection;
      uniform vec2 uSunOpeningCentre;
      uniform vec3 uSurfaceColour;
      uniform float uTime;
      uniform float uUseBackdrop;
      uniform float uUseRadianceLut;
      uniform float uWaterSurfaceY;
      ${OCEAN_NOISE_GLSL}
      ${OCEAN_RADIANCE_GLSL}

      void main() {
        gl_FragColor = vec4(oceanFarRadiance(vViewDirection), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

function createOceanNormalTexture(): DataTexture {
  const size = 128
  const octaveCellCounts = [4, 8, 16, 32] as const
  const octaveWeights = [0.48, 0.27, 0.16, 0.09] as const
  const grids = octaveCellCounts.map((cellCount, octaveIndex) => {
    const grid = new Float32Array(cellCount * cellCount)
    for (let index = 0; index < grid.length; index += 1) {
      grid[index] = seededUnit(index + octaveIndex * 997 + 211)
    }
    return { cellCount, grid }
  })
  const heights = new Float32Array(size * size)
  const smooth = (value: number) => value * value * (3 - 2 * value)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let height = 0
      for (let octaveIndex = 0; octaveIndex < grids.length; octaveIndex += 1) {
        const { cellCount, grid } = grids[octaveIndex]!
        const gx = (x / size) * cellCount
        const gy = (y / size) * cellCount
        const x0 = Math.floor(gx) % cellCount
        const y0 = Math.floor(gy) % cellCount
        const x1 = (x0 + 1) % cellCount
        const y1 = (y0 + 1) % cellCount
        const tx = smooth(gx - Math.floor(gx))
        const ty = smooth(gy - Math.floor(gy))
        const top = grid[y0 * cellCount + x0]! * (1 - tx) +
          grid[y0 * cellCount + x1]! * tx
        const bottom = grid[y1 * cellCount + x0]! * (1 - tx) +
          grid[y1 * cellCount + x1]! * tx
        height += (top * (1 - ty) + bottom * ty) * octaveWeights[octaveIndex]!
      }
      heights[y * size + x] = height
    }
  }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = heights[y * size + (x + size - 1) % size]!
      const right = heights[y * size + (x + 1) % size]!
      const down = heights[((y + size - 1) % size) * size + x]!
      const up = heights[((y + 1) % size) * size + x]!
      const nx = (left - right) * 8.5
      const ny = (down - up) * 8.5
      const inverseLength = 1 / Math.hypot(nx, ny, 1)
      const offset = (y * size + x) * 4
      data[offset] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255)
      data[offset + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255)
      data[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255)
      data[offset + 3] = 255
    }
  }
  const texture = new DataTexture(
    data,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.name = 'ocean-procedural-multiscale-normal-v1'
  texture.colorSpace = NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function createWaterSurfaceMaterial(
  lease: OceanBackdropTextureLease | null,
  normalTexture: DataTexture,
  radianceTexture: DataTexture,
): ShaderMaterial {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    side: BackSide,
    toneMapped: true,
    uniforms: {
      ...createOceanRadianceUniforms(lease, radianceTexture),
      uNormalMap: { value: normalTexture },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      varying vec2 vBroadWaveSlope;
      uniform float uTime;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec2 p = world.xz;
        vec2 directionA = normalize(vec2(0.86, -0.51));
        vec2 directionB = normalize(vec2(0.67, -0.74));
        vec2 directionC = normalize(vec2(0.96, -0.28));
        float phaseA = dot(p, directionA) * 0.095 + uTime * 0.18;
        float phaseB = dot(p, directionB) * 0.126 + uTime * 0.13;
        float phaseC = dot(p, directionC) * 0.057 + uTime * 0.08;
        float broad = sin(phaseA) * 0.52;
        broad += sin(phaseB) * 0.31;
        broad += sin(phaseC) * 0.17;
        world.y += broad * ${OCEAN_SURFACE_DISPLACEMENT_METERS.toFixed(2)};
        vWorldPosition = world.xyz;
        vBroadWaveSlope = (
          directionA * cos(phaseA) * 0.095 * 0.52 +
          directionB * cos(phaseB) * 0.126 * 0.31 +
          directionC * cos(phaseC) * 0.057 * 0.17
        ) * ${OCEAN_SURFACE_DISPLACEMENT_METERS.toFixed(2)};
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorldPosition;
      varying vec2 vBroadWaveSlope;
      uniform sampler2D uBackdrop;
      uniform sampler2D uRadianceLut;
      uniform vec3 uDeepColour;
      uniform vec3 uHorizonColour;
      uniform vec3 uSunColour;
      uniform vec3 uSunDirection;
      uniform vec2 uSunOpeningCentre;
      uniform vec3 uSurfaceColour;
      uniform sampler2D uNormalMap;
      uniform float uTime;
      uniform float uUseBackdrop;
      uniform float uUseRadianceLut;
      uniform float uWaterSurfaceY;
      ${OCEAN_NOISE_GLSL}
      ${OCEAN_RADIANCE_GLSL}

      vec2 oceanRippleSlope(vec2 p) {
        mat2 rotationA = mat2(0.86, -0.51, 0.51, 0.86);
        mat2 rotationB = mat2(0.62, 0.78, -0.78, 0.62);
        vec2 currentDirection = normalize(vec2(0.86, -0.51));
        vec2 sampleA = texture2D(
          uNormalMap,
          p * 0.058 + currentDirection * uTime * 0.014
        ).xy * 2.0 - 1.0;
        vec2 sampleB = texture2D(
          uNormalMap,
          rotationA * p * 0.096 + currentDirection * uTime * 0.016
        ).xy * 2.0 - 1.0;
        vec2 sampleC = texture2D(
          uNormalMap,
          rotationB * p * 0.167 + currentDirection * uTime * 0.019
        ).xy * 2.0 - 1.0;
        vec2 sampleD = texture2D(
          uNormalMap,
          -rotationA * p * 0.271 + currentDirection * uTime * 0.026
        ).xy * 2.0 - 1.0;
        return sampleA * 0.105 + sampleB * 0.080 +
          sampleC * 0.052 + sampleD * 0.033;
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        vec2 rippleSlope = oceanRippleSlope(p);
        vec2 totalSlope = vBroadWaveSlope + rippleSlope;
        vec3 surfaceNormal = normalize(vec3(-totalSlope.x, 1.0, -totalSlope.y));
        vec3 viewToCamera = normalize(cameraPosition - vWorldPosition);
        vec3 rayDirection = -viewToCamera;

        float viewCosine = abs(dot(surfaceNormal, viewToCamera));
        float fresnel = 0.02 + 0.98 * pow(1.0 - viewCosine, 5.0);
        vec3 reflectedDirection = reflect(rayDirection, -surfaceNormal);
        vec3 reflectedWater = oceanFarRadiance(reflectedDirection);

        float sunFacing = max(dot(surfaceNormal, uSunDirection), 0.0);
        float waveFocus = pow(sunFacing, 24.0);
        float broadLight = 0.58 + sunFacing * 0.30;
        vec3 transmittedLight = mix(
          uHorizonColour,
          uSurfaceColour,
          broadLight
        );
        transmittedLight += uSunColour * waveFocus * 0.23;
        float sunOpening = 1.0 - smoothstep(
          6.0,
          34.0,
          length(p - uSunOpeningCentre)
        );
        float openingBreakup = 0.78 + oceanValueNoise(
          p * 0.048 + vec2(uTime * 0.008, -uTime * 0.005)
        ) * 0.22;
        transmittedLight += uSunColour * sunOpening * openingBreakup * 0.24;

        vec3 halfVector = normalize(uSunDirection + viewToCamera);
        float sunGlint = pow(max(dot(surfaceNormal, halfVector), 0.0), 150.0);
        transmittedLight += uSunColour * sunGlint * 0.36;

        vec3 refractedDirection = refract(rayDirection, -surfaceNormal, 1.33);
        float totalInternalReflection =
          1.0 - step(0.001, dot(refractedDirection, refractedDirection));
        float reflectionWeight = clamp(
          fresnel + totalInternalReflection * 0.78,
          0.0,
          1.0
        );
        vec3 surfaceColour = mix(
          transmittedLight,
          reflectedWater,
          reflectionWeight
        );

        float radial = length(p) / 96.0;
        float farBlend = smoothstep(0.62, 0.98, radial);
        float grazingBlend = 1.0 - smoothstep(0.018, 0.16, abs(rayDirection.y));
        vec3 colour = mix(
          surfaceColour,
          oceanFarRadiance(rayDirection),
          max(farBlend, grazingBlend) * 0.98
        );
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

interface OceanSubjectLighting {
  readonly ambient: HemisphereLight
  readonly cameraFill: DirectionalLight
  readonly group: Group
  readonly surfaceKey: DirectionalLight
}

function createOceanSubjectLighting(): OceanSubjectLighting {
  const group = new Group()
  group.name = 'ocean-formal-subject-lighting'

  // Keep the environment visibly underwater, but use a near-neutral upper
  // hemisphere so skin, clothing and animal albedo are not cyan-white-balanced
  // by the scene lights before ACES tone mapping.
  const ambient = new HemisphereLight('#fff2d8', '#526d69', 2.35)
  ambient.name = 'ocean-surface-to-depth-hemisphere'

  const surfaceKey = new DirectionalLight('#ffe4ae', 4.1)
  surfaceKey.name = 'ocean-surface-key'
  surfaceKey.position.copy(OCEAN_SUN_DIRECTION).multiplyScalar(40)
  surfaceKey.target.position.set(0.8, 0.8, 0)
  surfaceKey.castShadow = false

  // This is an underwater white-balance compensation, not another aqua light.
  // A restrained warm-neutral fill restores authored subject colours while
  // the world-space fog and PMREM still provide the water-depth cue.
  const cameraSideFill = new DirectionalLight('#fff0dc', 2.6)
  cameraSideFill.name = 'ocean-camera-side-fill'
  cameraSideFill.position.set(-19, -1.5, 18)
  cameraSideFill.target.position.set(1.2, 1.1, 0)
  cameraSideFill.castShadow = false

  group.add(
    ambient,
    surfaceKey,
    surfaceKey.target,
    cameraSideFill,
    cameraSideFill.target,
  )
  return { ambient, cameraFill: cameraSideFill, group, surfaceKey }
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453
  return value - Math.floor(value)
}

type OceanParticulateMode = 'baseline' | 'layered-depth'

function createSuspendedParticulate(mode: OceanParticulateMode): Points {
  const layeredDepth = mode === 'layered-depth'
  const positions: number[] = []
  const sizes: number[] = []
  const opacities: number[] = []
  const kinds: number[] = []
  const riseSpans: number[] = []
  const speeds: number[] = []
  const phases: number[] = []
  const drifts: number[] = []
  const moteCount = layeredDepth ? 320 : 42
  for (let index = 0; index < moteCount; index += 1) {
    const angle = seededUnit(index + 71) * Math.PI * 2
    const radius = layeredDepth
      ? 2.8 * Math.pow(88 / 2.8, seededUnit(index + 79))
      : 13 + seededUnit(index + 79) * 70
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const top = OCEAN_WATER_SURFACE_Y - 2
    const bottom = oceanBedYAt(x, z) + 2
    const y = bottom + seededUnit(index + 83) * (top - bottom)
    positions.push(x, y, z)
    sizes.push(
      layeredDepth
        ? 0.48 + seededUnit(index + 97) * 1.15
        : 1.5 + seededUnit(index + 97) * 2.6,
    )
    opacities.push(
      layeredDepth
        ? 0.025 + seededUnit(index + 113) * 0.055
        : 0.22 + seededUnit(index + 113) * 0.34,
    )
    kinds.push(0)
    riseSpans.push(0)
    speeds.push(0)
    phases.push(seededUnit(index + 127))
    drifts.push(0)
  }
  // The production bubbles share the particulate draw call, but are clustered
  // through the animal, eye-view and overview corridors instead of being
  // scattered mostly beyond the guided cameras. This keeps them visible while
  // retaining open water around the subjects.
  // The second owner review still found the water column too sparse. Keep the
  // same single draw call and corridor distribution, but give each guided
  // corridor twenty bubbles and lift the broad fallback proportionally.
  const bubbleCount = layeredDepth ? 60 : 48
  for (let index = 0; index < bubbleCount; index += 1) {
    const seed = index + 401
    let x: number
    let z: number
    if (layeredDepth) {
      const corridor = index % 3
      const angle = seededUnit(seed) * Math.PI * 2
      const radius = Math.sqrt(seededUnit(seed + 17))
      const centreX = corridor === 0 ? -8 : corridor === 1 ? 1.5 : 0
      const centreZ = corridor === 0 ? 6 : corridor === 1 ? 1 : 38
      const radiusX = corridor === 0 ? 13 : corridor === 1 ? 11 : 25
      const radiusZ = corridor === 0 ? 11 : corridor === 1 ? 9 : 30
      x = centreX + Math.cos(angle) * radius * radiusX
      z = centreZ + Math.sin(angle) * radius * radiusZ
    } else {
      const angle = seededUnit(seed) * Math.PI * 2
      const radius = 8 + Math.pow(seededUnit(seed + 17), 0.72) * 72
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius
    }
    const bottom = oceanBedYAt(x, z) + 3 + seededUnit(seed + 23) * 8
    const top = OCEAN_WATER_SURFACE_Y - 1.5
    positions.push(x, bottom, z)
    sizes.push(
      (layeredDepth ? 4 : 3.2) +
        seededUnit(seed + 31) * (layeredDepth ? 4.6 : 4.8),
    )
    opacities.push(
      (layeredDepth ? 0.28 : 0.3) +
        seededUnit(seed + 43) * (layeredDepth ? 0.22 : 0.28),
    )
    kinds.push(1)
    riseSpans.push(Math.max(1, top - bottom))
    speeds.push(0.38 + seededUnit(seed + 59) * 0.74)
    phases.push(seededUnit(seed + 67))
    drifts.push(0.12 + seededUnit(seed + 71) * 0.34)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(sizes), 1))
  geometry.setAttribute('aOpacity', new BufferAttribute(new Float32Array(opacities), 1))
  geometry.setAttribute('aKind', new BufferAttribute(new Float32Array(kinds), 1))
  geometry.setAttribute('aRiseSpan', new BufferAttribute(new Float32Array(riseSpans), 1))
  geometry.setAttribute('aSpeed', new BufferAttribute(new Float32Array(speeds), 1))
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1))
  geometry.setAttribute('aDrift', new BufferAttribute(new Float32Array(drifts), 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const material = new ShaderMaterial({
    blending: layeredDepth ? NormalBlending : AdditiveBlending,
    depthWrite: false,
    toneMapped: true,
    transparent: true,
    uniforms: {
      uColour: {
        value: new Color(layeredDepth ? '#c4e5ed' : '#d8fff0'),
      },
      uCurrentDirection: { value: OCEAN_CURRENT_DIRECTION_XZ.clone() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aKind;
      attribute float aRiseSpan;
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aDrift;
      varying float vOpacity;
      varying float vKind;
      uniform vec2 uCurrentDirection;
      uniform float uTime;
      void main() {
        vec3 animatedPosition = position;
        float currentSpeed = mix(
          ${OCEAN_MOTE_CURRENT_SPEED_METERS_PER_SECOND.toFixed(3)},
          ${OCEAN_BUBBLE_CURRENT_SPEED_METERS_PER_SECOND.toFixed(3)},
          aKind
        );
        float currentTravel = mod(
          aPhase * ${OCEAN_CURRENT_WRAP_METERS.toFixed(1)} +
            uTime * currentSpeed,
          ${OCEAN_CURRENT_WRAP_METERS.toFixed(1)}
        ) - ${(
          OCEAN_CURRENT_WRAP_METERS / 2
        ).toFixed(1)};
        animatedPosition.xz += uCurrentDirection * currentTravel;
        if (aKind > 0.5) {
          animatedPosition.y += mod(
            aPhase * aRiseSpan + uTime * aSpeed,
            max(aRiseSpan, 0.001)
          );
          float driftPhase = aPhase * 6.2831853 + uTime * 0.38;
          animatedPosition.x += sin(driftPhase) * aDrift;
          animatedPosition.z += cos(driftPhase * 0.83) * aDrift * 0.72;
        }
        vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        vOpacity = aOpacity;
        vKind = aKind;
        float sizeScale = mix(120.0, 162.0, aKind);
        float maximumSize = mix(${layeredDepth ? '3.2' : '4.2'}, 12.0, aKind);
        gl_PointSize = clamp(
          aSize * (sizeScale / max(8.0, -viewPosition.z)),
          mix(1.1, 2.8, aKind),
          maximumSize
        );
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColour;
      varying float vOpacity;
      varying float vKind;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float moteAlpha = 1.0 - smoothstep(0.12, 0.5, radius);
        float bubbleOuter = 1.0 - smoothstep(0.39, 0.5, radius);
        float bubbleInner = 1.0 - smoothstep(0.27, 0.39, radius);
        float bubbleRing = max(0.0, bubbleOuter - bubbleInner);
        float bubbleHighlight = 1.0 - smoothstep(
          0.035,
          0.13,
          length(gl_PointCoord - vec2(0.34, 0.32))
        );
        float bubbleAlpha = bubbleRing * 0.78 + bubbleHighlight * 0.34;
        float alpha = mix(moteAlpha, bubbleAlpha, vKind) * vOpacity;
        if (alpha < 0.01) discard;
        vec3 bubbleColour = mix(uColour, vec3(1.0, 0.97, 0.88), 0.42);
        gl_FragColor = vec4(mix(uColour, bubbleColour, vKind), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const points = new Points(geometry, material)
  points.name = layeredDepth
    ? 'ocean-layered-depth-particulate'
    : 'ocean-suspended-particulate-and-rising-bubbles'
  points.userData.risingBubbleCount = bubbleCount
  points.userData.suspendedParticulateCount = moteCount
  points.userData.currentDirectionXZ = OCEAN_CURRENT_DIRECTION_XZ.toArray()
  points.userData.currentSpeedMetersPerSecond = {
    bubbles: OCEAN_BUBBLE_CURRENT_SPEED_METERS_PER_SECOND,
    motes: OCEAN_MOTE_CURRENT_SPEED_METERS_PER_SECOND,
  }
  points.userData.currentWrapMeters = OCEAN_CURRENT_WRAP_METERS
  points.userData.bubbleDistribution = layeredDepth
    ? 'guided-observation-corridors'
    : 'broad-radial'
  points.frustumCulled = false
  points.renderOrder = 2
  return points
}

function materialList(object: Mesh | Points | InstancedMesh): readonly Material[] {
  return Array.isArray(object.material) ? object.material : [object.material]
}

function isRenderable(object: Object3D): object is Mesh | Points | InstancedMesh {
  return object instanceof Mesh || object instanceof Points || object instanceof InstancedMesh
}

function effectivelyVisible(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

function triangleCount(geometry: BufferGeometry): number {
  return geometry.index
    ? geometry.index.count / 3
    : (geometry.getAttribute('position')?.count ?? 0) / 3
}

function inspectResources(
  root: Group,
  borrowedTextureBytes: number,
): OceanResourceDiagnostics {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<unknown>()
  let drawCalls = 0
  let opaqueDrawCalls = 0
  let transparentDrawCalls = 0
  let instances = 0
  let objects = 0
  let triangles = 0
  root.traverse((object) => {
    if (!effectivelyVisible(object)) return
    objects += 1
    if (!isRenderable(object)) return
    drawCalls += 1
    const objectMaterials = materialList(object)
    const transparent = objectMaterials.some((material) => material.transparent)
    if (transparent) transparentDrawCalls += 1
    else opaqueDrawCalls += 1
    geometries.add(object.geometry)
    objectMaterials.forEach((material) => {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
      if (material instanceof ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof Texture) textures.add(uniform.value)
        }
      }
    })
    const instanceCount = object instanceof InstancedMesh ? object.count : 1
    instances += instanceCount
    triangles += triangleCount(object.geometry) * instanceCount
  })
  const proceduralTextureBytes = [...textures]
    .filter((texture): texture is DataTexture => texture instanceof DataTexture)
    .reduce((sum, texture) => {
      const data = texture.image as { readonly height?: number; readonly width?: number }
      const bytesPerChannel = texture.type === HalfFloatType ? 2 : 1
      const mipFactor = texture.generateMipmaps ? 4 / 3 : 1
      return sum +
        (data.width ?? 0) *
          (data.height ?? 0) *
          4 *
          bytesPerChannel *
          mipFactor
    }, 0)
  return {
    drawCalls,
    estimatedDecodedTextureBytes: Math.round(
      borrowedTextureBytes + proceduralTextureBytes,
    ),
    geometries: geometries.size,
    instances,
    materials: materials.size,
    objects,
    opaqueDrawCalls,
    textures: textures.size,
    transparentDrawCalls,
    transparentMaterialCount: [...materials].filter(
      (material) => material.transparent,
    ).length,
    transparentScreenCoverageEstimate:
      transparentDrawCalls === 0 ? 0 : 0.009,
    triangles: Math.round(triangles),
  }
}

function createBoundaryContour(): LineLoop {
  const positions: number[] = []
  const samples = 96
  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2
    const x = Math.cos(angle) * OCEAN_WORLD_RADIUS
    const z = Math.sin(angle) * OCEAN_WORLD_RADIUS
    positions.push(x, oceanBedYAt(x, z) + 0.05, z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  const line = new LineLoop(
    geometry,
    new LineBasicMaterial({ color: '#ffb95c' }),
  )
  line.name = 'ocean-debug-seabed-boundary'
  return line
}

function disposeObjectTree(
  root: Object3D,
  borrowedTextures: ReadonlySet<unknown>,
): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<unknown>()
  root.traverse((object) => {
    if (!isRenderable(object) && !(object instanceof LineLoop) && !(object instanceof Box3Helper)) {
      return
    }
    const geometry = (object as Mesh | Points | LineLoop | Box3Helper).geometry
    if (geometry) geometries.add(geometry)
    const material = (object as Mesh | Points | LineLoop | Box3Helper).material
    const objectMaterials = Array.isArray(material) ? material : [material]
    for (const entry of objectMaterials) {
      if (!entry) continue
      materials.add(entry)
      for (const value of Object.values(entry)) {
        if (value instanceof Texture && !borrowedTextures.has(value)) {
          textures.add(value)
        }
      }
      if (entry instanceof ShaderMaterial) {
        for (const uniform of Object.values(entry.uniforms)) {
          if (
            uniform.value instanceof Texture &&
            !borrowedTextures.has(uniform.value)
          ) {
            textures.add(uniform.value)
          }
        }
      }
    }
  })
  textures.forEach((texture) => {
    if (texture instanceof Texture) texture.dispose()
  })
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
  root.removeFromParent()
  root.clear()
}

export function createOceanEnvironmentCandidate(
  options: CreateOceanEnvironmentCandidateOptions,
): OceanEnvironmentCandidate {
  const root = new Group()
  root.name = 'scale-encounter-ocean-candidate'
  const layerRoots = Object.fromEntries(
    OCEAN_ENVIRONMENT_LAYERS.map((layer) => {
      const group = new Group()
      group.name = `ocean-layer-${layer}`
      root.add(group)
      return [layer, group]
    }),
  ) as Record<OceanEnvironmentLayer, Group>

  const backdropTextureLease = options.backdropTexture ?? null
  if (backdropTextureLease) {
    backdropTextureLease.texture.colorSpace = SRGBColorSpace
    backdropTextureLease.texture.generateMipmaps = true
    backdropTextureLease.texture.minFilter = LinearMipmapLinearFilter
    backdropTextureLease.texture.magFilter = LinearFilter
    backdropTextureLease.texture.needsUpdate = true
  }
  const radianceTexture = createOceanRadianceLut()
  const backdropMaterial = createBackdropMaterial(
    backdropTextureLease,
    radianceTexture,
  )
  const backdrop = new Mesh(
    new SphereGeometry(180, 32, 16),
    backdropMaterial,
  )
  backdrop.name = 'ocean-background-approved-exhibit-reference'
  backdrop.frustumCulled = false
  backdrop.renderOrder = -100
  layerRoots['background-scatter'].add(backdrop)

  const surfaceNormalTexture = createOceanNormalTexture()
  const surfaceMaterial = createWaterSurfaceMaterial(
    backdropTextureLease,
    surfaceNormalTexture,
    radianceTexture,
  )
  const surface = new Mesh(
    new PlaneGeometry(
      OCEAN_WORLD_RADIUS * 2,
      OCEAN_WORLD_RADIUS * 2,
      64,
      64,
    ),
    surfaceMaterial,
  )
  surface.name = 'ocean-world-water-surface'
  surface.position.y = OCEAN_WATER_SURFACE_Y
  surface.rotation.x = -Math.PI / 2
  surface.renderOrder = -5
  layerRoots['water-surface'].add(surface)

  const volumeContract = new Group()
  volumeContract.name = 'ocean-world-water-volume-contract'
  volumeContract.userData.oceanWaterVolumeBounds = OCEAN_WATER_VOLUME_BOUNDS.clone()
  layerRoots['water-volume'].add(volumeContract)

  const borrowedTextures = new Set<unknown>()
  if (backdropTextureLease) {
    borrowedTextures.add(backdropTextureLease.texture)
  }
  // Leon's final direction explicitly forbids a visible seabed. Keep only
  // the mathematical lower boundary in ocean-spatial-contract; no seabed
  // mesh, texture lease, caustic receiver, or grounded prop is instantiated.
  layerRoots.seabed.userData.oceanInvisibleBoundaryOnly = true
  const groundedObjects: OceanGroundedPlacement[] = []
  const {
    ambient: subjectAmbient,
    cameraFill: cameraSideFill,
    group: subjectLighting,
    surfaceKey,
  } = createOceanSubjectLighting()
  const cameraFillForward = new Vector3()
  root.add(subjectLighting)

  // All visible surface light stays in the far-radiance single-scattering
  // shader. Mobile review showed that explicit cone geometry reads as a row of
  // underwater spotlights, even with soft shells. Broad, overlapping FBM
  // apertures retain motion without any silhouette or screen-facing light card.
  layerRoots['mid-water'].userData.worldSpaceSingleScattering = true
  layerRoots.caustics.userData.surfaceNormalFocusedTransmission = true
  layerRoots['near-water'].userData.corridorSafeSparseMotes = true
  layerRoots['far-volume'].userData.openWaterFogAndBackdrop = true

  const baselineParticulate = createSuspendedParticulate('baseline')
  const layeredDepthParticulate = createSuspendedParticulate('layered-depth')
  layerRoots['suspended-particulate'].add(
    baselineParticulate,
    layeredDepthParticulate,
  )

  const approvedEcologyClues = options.approvedEcologyClues ?? []
  for (const clue of approvedEcologyClues) {
    if (clue.status !== 'approved-for-ocean-slice') continue
    clue.object.name ||= `ocean-approved-ecology-${clue.id}`
    layerRoots['ecology-clues'].add(clue.object)
  }

  const debugRoot = new Group()
  debugRoot.name = 'ocean-review-debug-boundaries'
  const volumeHelper = new Box3Helper(OCEAN_WATER_VOLUME_BOUNDS, '#68f3e8')
  volumeHelper.name = 'ocean-debug-water-volume'
  const seabedContour = createBoundaryContour()
  debugRoot.add(volumeHelper, seabedContour)
  root.add(debugRoot)
  let observationDebugRoot = new Group()
  observationDebugRoot.name = 'ocean-review-debug-observation-corridor'
  debugRoot.add(observationDebugRoot)

  const explicitLayerOverrides = new Map<OceanEnvironmentLayer, boolean>()
  let currentVariant = options.variant
  let observationContext: OceanObservationContext | null = null
  let spatialDiagnostics: OceanSpatialDiagnostics | null = null
  let debugVisible = options.debug ?? false

  const applyVisibility = () => {
    const defaults = layerDefaults[currentVariant]
    for (const layer of OCEAN_ENVIRONMENT_LAYERS) {
      const requested = explicitLayerOverrides.get(layer) ?? defaults.has(layer)
      layerRoots[layer].visible =
        layer === 'seabed'
          ? false
          : layer === 'ecology-clues'
          ? requested && layerRoots[layer].children.length > 0
          : requested
    }
    const coherentRadiance = currentVariant === 'D'
    backdropMaterial.uniforms.uUseRadianceLut!.value = coherentRadiance ? 1 : 0
    surfaceMaterial.uniforms.uUseRadianceLut!.value = coherentRadiance ? 1 : 0
    baselineParticulate.visible = !coherentRadiance
    layeredDepthParticulate.visible = coherentRadiance
    subjectAmbient.intensity = coherentRadiance ? 1.82 : 2.35
    surfaceKey.intensity = coherentRadiance ? 3.45 : 4.1
    debugRoot.visible = debugVisible
    if (observationContext) {
      spatialDiagnostics = diagnoseOceanSpatialContract(
        observationContext,
        groundedObjects.filter(({ layer }) => layerRoots[layer].visible),
        false,
      )
    }
  }

  const rebuildObservationDebug = (context: OceanObservationContext) => {
    disposeObjectTree(observationDebugRoot, borrowedTextures)
    observationDebugRoot = new Group()
    observationDebugRoot.name = 'ocean-review-debug-observation-corridor'
    observationDebugRoot.add(
      new Box3Helper(context.animalBounds.clone(), '#ffca68'),
      new Box3Helper(context.avatarBounds.clone(), '#ff7ca8'),
      ...context.cameraSamples.map(({ label, position }) => {
        const box = new Box3().setFromCenterAndSize(
          position,
          new Vector3(0.5, 0.5, 0.5),
        )
        const helper = new Box3Helper(box, '#fff19a')
        helper.name = `ocean-debug-camera-${label}`
        return helper
      }),
    )
    debugRoot.add(observationDebugRoot)
  }

  const getLayerState = (): Record<OceanEnvironmentLayer, boolean> =>
    Object.fromEntries(
      OCEAN_ENVIRONMENT_LAYERS.map((layer) => [layer, layerRoots[layer].visible]),
    ) as Record<OceanEnvironmentLayer, boolean>

  applyVisibility()

  return {
    radianceTexture,
    root,
    toneMapping: ACESFilmicToneMapping,
    dispose: () => disposeObjectTree(root, borrowedTextures),
    getDiagnostics: () => {
      const layers = getLayerState()
      const resources = inspectResources(
        root,
        (backdropTextureLease?.decodedByteEstimate ?? 0) +
          0,
      )
      const depthWriteDisabledDraws = (() => {
        let count = 0
        root.traverse((object) => {
          if (!effectivelyVisible(object) || !isRenderable(object)) return
          if (materialList(object).some((material) => !material.depthWrite)) {
            count += 1
          }
        })
        return count
      })()
      return {
        alpha: {
          cardCount: 0,
          depthWriteDisabledDraws,
          repeatedCardGroups: 0,
        },
        approvedEcologyAssetIds: approvedEcologyClues.map(({ id }) => id),
        browserIndependentDesignChecks: {
          colourDiscontinuityBands: 0,
          ecologyFallbackReason:
            approvedEcologyClues.length === 0
              ? 'No ocean ecology asset is approved in the supplied manifest; C keeps the ecology layer empty.'
              : null,
          repeatedFarCards: 0,
        },
        fogDensity: 0,
        fogFar:
          currentVariant === 'A' ||
          currentVariant === 'D' ||
          !layers['water-volume']
            ? null
            : OCEAN_FOG_FAR_BY_VARIANT[currentVariant],
        fogModel:
          currentVariant === 'A' ||
          currentVariant === 'D' ||
          !layers['water-volume']
            ? 'none'
            : 'linear-depth',
        fogNear:
          currentVariant === 'A' ||
          currentVariant === 'D' ||
          !layers['water-volume']
            ? null
            : OCEAN_FOG_NEAR_BY_VARIANT[currentVariant],
        layers,
        naturalnessRevision:
          currentVariant === 'D'
            ? OCEAN_COHERENT_RADIANCE_REVISION
            : OCEAN_NATURALNESS_REVISION,
        resources,
        spatial: spatialDiagnostics,
        variant: currentVariant,
        world: {
          metresPerUnit: 1,
          toneMapping: 'ACESFilmicToneMapping',
          upAxis: '+Y',
          waterSurfaceY: OCEAN_WATER_SURFACE_Y,
          waterSurfaceDisplacementMeters: OCEAN_SURFACE_DISPLACEMENT_METERS,
        },
      }
    },
    getFog: () => {
      if (
        currentVariant === 'A' ||
        currentVariant === 'D' ||
        !layerRoots['water-volume'].visible
      ) {
        return null
      }
      return new Fog(
        OCEAN_FOG_COLOUR,
        OCEAN_FOG_NEAR_BY_VARIANT[currentVariant],
        OCEAN_FOG_FAR_BY_VARIANT[currentVariant],
      )
    },
    setDebugVisible: (visible) => {
      debugVisible = visible
      applyVisibility()
    },
    setLayerEnabled: (layer, enabled) => {
      explicitLayerOverrides.set(layer, enabled)
      applyVisibility()
    },
    setObservationContext: (context) => {
      observationContext = context
      rebuildObservationDebug(context)
      applyVisibility()
    },
    setVariant: (variant) => {
      currentVariant = variant
      explicitLayerOverrides.clear()
      applyVisibility()
    },
    update: (elapsedSeconds, camera) => {
      backdrop.position.copy(camera.position)
      if (camera instanceof PerspectiveCamera) {
        // At the true-scale overview, a strong frontal fill flattens the small
        // animal silhouette and pushes its belly toward white. The guided
        // close-up needs the opposite treatment: the avatar fills the frame,
        // so lift its camera-facing skin and clothing without raising the
        // exposure, PMREM or fog colour for the entire underwater scene.
        const overviewAmount = Math.max(
          0,
          Math.min(1, (48 - camera.fov) / 19),
        )
        cameraSideFill.position.copy(camera.position)
        cameraFillForward
          .set(0, 0, -1)
          .applyQuaternion(camera.quaternion)
          .normalize()
        cameraSideFill.target.position
          .copy(camera.position)
          .addScaledVector(cameraFillForward, 20)
        cameraSideFill.intensity = currentVariant === 'D'
          ? 3.05 - overviewAmount * 1.12
          : 4.25 - overviewAmount * 1.65
      }
      backdropMaterial.uniforms.uTime!.value = elapsedSeconds
      surfaceMaterial.uniforms.uTime!.value = elapsedSeconds
      ;(baselineParticulate.material as ShaderMaterial).uniforms.uTime!.value =
        elapsedSeconds
      ;(layeredDepthParticulate.material as ShaderMaterial).uniforms.uTime!.value =
        elapsedSeconds
      // The same slow surface-wave rhythm slightly modulates the subject key.
      // Two incommensurate frequencies avoid an obvious breathing loop while
      // keeping the change gentle enough for young children and reduced visual
      // distraction around the controls.
      const subjectKeyBase = currentVariant === 'D' ? 3.38 : 4.02
      surfaceKey.intensity = subjectKeyBase +
        Math.sin(elapsedSeconds * 0.29) * 0.12 +
        Math.sin(elapsedSeconds * 0.47 + 1.3) * 0.065
    },
  }
}
