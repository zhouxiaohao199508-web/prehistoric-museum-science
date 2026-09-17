import { Color, type ColorRepresentation, type MeshStandardMaterial } from 'three'

const LAND_BIOME_GROUND_REVISION = 'land-biome-stochastic-pbr-v1'
const LAND_BIOME_GROUND_USER_DATA_KEY =
  'scaleEncounterLandBiomeGroundMaterial'

export interface ScaleEncounterLandBiomeGroundMaterialOptions {
  readonly darkTint: ColorRepresentation
  readonly lightTint: ColorRepresentation
  readonly macroVariationStrength?: number
  readonly normalFadeEndMeters?: number
  readonly normalFadeStartMeters?: number
  readonly physicalWidthMeters: number
  readonly stochasticCellSizeMeters?: number
}

type GroundShader = Parameters<MeshStandardMaterial['onBeforeCompile']>[0]

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function patchVertexShader(vertexShader: string): string {
  return vertexShader
    .replace(
      'varying vec3 vViewPosition;',
      `varying vec3 vViewPosition;
varying vec2 vScaleEncounterLandBiomePosition;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
	vScaleEncounterLandBiomePosition = position.xz;`,
    )
}

const LAND_BIOME_FRAGMENT_HEADER = `varying vec3 vViewPosition;
varying vec2 vScaleEncounterLandBiomePosition;
uniform vec3 uScaleEncounterLandBiomeGroundMetrics;
uniform vec2 uScaleEncounterLandBiomeNormalFade;
uniform vec3 uScaleEncounterLandBiomeDarkTint;
uniform vec3 uScaleEncounterLandBiomeLightTint;
uniform float uScaleEncounterLandBiomeMacroStrength;

struct ScaleEncounterLandBiomeFrame {
	vec3 weights;
	vec2 uvA;
	vec2 uvB;
	vec2 uvC;
	float rotationA;
	float rotationB;
	float rotationC;
};

float scaleEncounterLandBiomeHash12(vec2 value) {
	vec3 hash = fract(vec3(value.xyx) * 0.1031);
	hash += dot(hash, hash.yzx + 33.33);
	return fract((hash.x + hash.y) * hash.z);
}

vec2 scaleEncounterLandBiomeHash22(vec2 value) {
	vec3 hash = fract(vec3(value.xyx) * vec3(0.1031, 0.1030, 0.0973));
	hash += dot(hash, hash.yzx + 33.33);
	return fract((hash.xx + hash.yz) * hash.zy);
}

float scaleEncounterLandBiomeNoise(vec2 point) {
	vec2 cell = floor(point);
	vec2 blend = fract(point);
	blend = blend * blend * (3.0 - 2.0 * blend);
	float a = scaleEncounterLandBiomeHash12(cell);
	float b = scaleEncounterLandBiomeHash12(cell + vec2(1.0, 0.0));
	float c = scaleEncounterLandBiomeHash12(cell + vec2(0.0, 1.0));
	float d = scaleEncounterLandBiomeHash12(cell + vec2(1.0, 1.0));
	return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

vec2 scaleEncounterLandBiomeRotateUv(vec2 uv, float rotation) {
	if (rotation < 0.5) return uv;
	if (rotation < 1.5) return vec2(-uv.y, uv.x);
	if (rotation < 2.5) return -uv;
	return vec2(uv.y, -uv.x);
}

vec2 scaleEncounterLandBiomeRestoreNormal(vec2 normalXy, float rotation) {
	if (rotation < 0.5) return normalXy;
	if (rotation < 1.5) return vec2(normalXy.y, -normalXy.x);
	if (rotation < 2.5) return -normalXy;
	return vec2(-normalXy.y, normalXy.x);
}

void scaleEncounterLandBiomeResolveTile(
	vec2 textureUv,
	vec2 tileId,
	out vec2 transformedUv,
	out float rotation
) {
	rotation = floor(
		scaleEncounterLandBiomeHash12(tileId + vec2(37.2, 91.7)) * 4.0
	);
	vec2 offset =
		scaleEncounterLandBiomeHash22(tileId + vec2(11.3, 53.1)) * 29.0;
	transformedUv =
		scaleEncounterLandBiomeRotateUv(textureUv, rotation) + offset;
}

ScaleEncounterLandBiomeFrame scaleEncounterLandBiomeResolveFrame(
	vec2 localPosition
) {
	vec2 gridPosition = vec2(
		localPosition.x - localPosition.y * 0.5773502692,
		localPosition.y * 1.1547005384
	) / uScaleEncounterLandBiomeGroundMetrics.y;
	vec2 baseCell = floor(gridPosition);
	vec2 withinCell = fract(gridPosition);
	vec2 tileA;
	vec2 tileB;
	vec2 tileC;
	vec3 weights;
	if (withinCell.x + withinCell.y < 1.0) {
		tileA = baseCell;
		tileB = baseCell + vec2(1.0, 0.0);
		tileC = baseCell + vec2(0.0, 1.0);
		weights = vec3(
			1.0 - withinCell.x - withinCell.y,
			withinCell.x,
			withinCell.y
		);
	} else {
		tileA = baseCell + vec2(1.0, 1.0);
		tileB = baseCell + vec2(0.0, 1.0);
		tileC = baseCell + vec2(1.0, 0.0);
		weights = vec3(
			withinCell.x + withinCell.y - 1.0,
			1.0 - withinCell.x,
			1.0 - withinCell.y
		);
	}
	weights = max(weights, vec3(0.0));
	weights *= weights * weights;
	weights /= max(dot(weights, vec3(1.0)), 0.0001);

	vec2 textureUv =
		localPosition / uScaleEncounterLandBiomeGroundMetrics.x;
	ScaleEncounterLandBiomeFrame frame;
	frame.weights = weights;
	scaleEncounterLandBiomeResolveTile(
		textureUv,
		tileA,
		frame.uvA,
		frame.rotationA
	);
	scaleEncounterLandBiomeResolveTile(
		textureUv,
		tileB,
		frame.uvB,
		frame.rotationB
	);
	scaleEncounterLandBiomeResolveTile(
		textureUv,
		tileC,
		frame.uvC,
		frame.rotationC
	);
	return frame;
}`

const LAND_BIOME_FRAME_INITIALIZATION = `
	ScaleEncounterLandBiomeFrame scaleEncounterLandBiomeFrame =
		scaleEncounterLandBiomeResolveFrame(
			vScaleEncounterLandBiomePosition
		);
	float scaleEncounterLandBiomeNormalDetail = 1.0 - smoothstep(
		uScaleEncounterLandBiomeNormalFade.x,
		uScaleEncounterLandBiomeNormalFade.y,
		length(vViewPosition)
	);`

const LAND_BIOME_MAP_FRAGMENT = `
#ifdef USE_MAP

	vec4 scaleEncounterLandBiomeMapA = texture2D(
		map,
		scaleEncounterLandBiomeFrame.uvA
	);
	vec4 scaleEncounterLandBiomeMapB = texture2D(
		map,
		scaleEncounterLandBiomeFrame.uvB
	);
	vec4 scaleEncounterLandBiomeMapC = texture2D(
		map,
		scaleEncounterLandBiomeFrame.uvC
	);
	vec4 sampledDiffuseColor =
		scaleEncounterLandBiomeMapA * scaleEncounterLandBiomeFrame.weights.x +
		scaleEncounterLandBiomeMapB * scaleEncounterLandBiomeFrame.weights.y +
		scaleEncounterLandBiomeMapC * scaleEncounterLandBiomeFrame.weights.z;

	#ifdef DECODE_VIDEO_TEXTURE

		sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);

	#endif

	vec2 scaleEncounterLandBiomeWarp = vec2(
		scaleEncounterLandBiomeNoise(
			vScaleEncounterLandBiomePosition / 41.0 + vec2(8.3, -13.7)
		),
		scaleEncounterLandBiomeNoise(
			vScaleEncounterLandBiomePosition / 37.0 + vec2(-5.1, 17.9)
		)
	) - 0.5;
	float scaleEncounterLandBiomeMacro =
		scaleEncounterLandBiomeNoise(
			(vScaleEncounterLandBiomePosition + scaleEncounterLandBiomeWarp * 17.0) /
			53.0
		) * 0.62 +
		scaleEncounterLandBiomeNoise(
			vScaleEncounterLandBiomePosition / 19.0 + vec2(21.4, -7.6)
		) * 0.38;
	vec3 scaleEncounterLandBiomeMacroTint = mix(
		uScaleEncounterLandBiomeDarkTint,
		uScaleEncounterLandBiomeLightTint,
		scaleEncounterLandBiomeMacro
	);
	sampledDiffuseColor.rgb = mix(
		sampledDiffuseColor.rgb,
		sampledDiffuseColor.rgb * scaleEncounterLandBiomeMacroTint,
		uScaleEncounterLandBiomeMacroStrength
	);
	diffuseColor *= sampledDiffuseColor;

#endif`

const LAND_BIOME_ROUGHNESS_FRAGMENT = `
float roughnessFactor = roughness;

#ifdef USE_ROUGHNESSMAP

	float scaleEncounterLandBiomeRoughness =
		texture2D(roughnessMap, scaleEncounterLandBiomeFrame.uvA).g *
			scaleEncounterLandBiomeFrame.weights.x +
		texture2D(roughnessMap, scaleEncounterLandBiomeFrame.uvB).g *
			scaleEncounterLandBiomeFrame.weights.y +
		texture2D(roughnessMap, scaleEncounterLandBiomeFrame.uvC).g *
			scaleEncounterLandBiomeFrame.weights.z;
	roughnessFactor *= scaleEncounterLandBiomeRoughness;

#endif`

const LAND_BIOME_NORMAL_FRAGMENT = `
#ifdef USE_NORMALMAP_OBJECTSPACE

	vec3 scaleEncounterLandBiomeNormalA =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvA).xyz * 2.0 - 1.0;
	vec3 scaleEncounterLandBiomeNormalB =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvB).xyz * 2.0 - 1.0;
	vec3 scaleEncounterLandBiomeNormalC =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvC).xyz * 2.0 - 1.0;
	scaleEncounterLandBiomeNormalA.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalA.xy,
		scaleEncounterLandBiomeFrame.rotationA
	);
	scaleEncounterLandBiomeNormalB.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalB.xy,
		scaleEncounterLandBiomeFrame.rotationB
	);
	scaleEncounterLandBiomeNormalC.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalC.xy,
		scaleEncounterLandBiomeFrame.rotationC
	);
	normal = normalize(
		scaleEncounterLandBiomeNormalA * scaleEncounterLandBiomeFrame.weights.x +
		scaleEncounterLandBiomeNormalB * scaleEncounterLandBiomeFrame.weights.y +
		scaleEncounterLandBiomeNormalC * scaleEncounterLandBiomeFrame.weights.z
	);
	normal.xy *= scaleEncounterLandBiomeNormalDetail;
	normal = normalize(normalMatrix * normal);

#elif defined(USE_NORMALMAP_TANGENTSPACE)

	vec3 scaleEncounterLandBiomeNormalA =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvA).xyz * 2.0 - 1.0;
	vec3 scaleEncounterLandBiomeNormalB =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvB).xyz * 2.0 - 1.0;
	vec3 scaleEncounterLandBiomeNormalC =
		texture2D(normalMap, scaleEncounterLandBiomeFrame.uvC).xyz * 2.0 - 1.0;
	scaleEncounterLandBiomeNormalA.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalA.xy,
		scaleEncounterLandBiomeFrame.rotationA
	);
	scaleEncounterLandBiomeNormalB.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalB.xy,
		scaleEncounterLandBiomeFrame.rotationB
	);
	scaleEncounterLandBiomeNormalC.xy = scaleEncounterLandBiomeRestoreNormal(
		scaleEncounterLandBiomeNormalC.xy,
		scaleEncounterLandBiomeFrame.rotationC
	);
	vec3 mapN = normalize(
		scaleEncounterLandBiomeNormalA * scaleEncounterLandBiomeFrame.weights.x +
		scaleEncounterLandBiomeNormalB * scaleEncounterLandBiomeFrame.weights.y +
		scaleEncounterLandBiomeNormalC * scaleEncounterLandBiomeFrame.weights.z
	);
	mapN.xy *= normalScale * scaleEncounterLandBiomeNormalDetail;
	normal = normalize(tbn * mapN);

#elif defined(USE_BUMPMAP)

	normal = perturbNormalArb(
		-vViewPosition,
		normal,
		dHdxy_fwd(),
		faceDirection
	);

#endif`

function patchShader(
  shader: GroundShader,
  options: Required<
    Pick<
      ScaleEncounterLandBiomeGroundMaterialOptions,
      | 'macroVariationStrength'
      | 'normalFadeEndMeters'
      | 'normalFadeStartMeters'
      | 'physicalWidthMeters'
      | 'stochasticCellSizeMeters'
    >
  > & {
    readonly darkTint: Color
    readonly lightTint: Color
  },
): void {
  shader.uniforms.uScaleEncounterLandBiomeGroundMetrics = {
    value: [options.physicalWidthMeters, options.stochasticCellSizeMeters, 0],
  }
  shader.uniforms.uScaleEncounterLandBiomeNormalFade = {
    value: [options.normalFadeStartMeters, options.normalFadeEndMeters],
  }
  shader.uniforms.uScaleEncounterLandBiomeDarkTint = {
    value: options.darkTint,
  }
  shader.uniforms.uScaleEncounterLandBiomeLightTint = {
    value: options.lightTint,
  }
  shader.uniforms.uScaleEncounterLandBiomeMacroStrength = {
    value: options.macroVariationStrength,
  }
  shader.vertexShader = patchVertexShader(shader.vertexShader)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      'varying vec3 vViewPosition;',
      LAND_BIOME_FRAGMENT_HEADER,
    )
    .replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );
${LAND_BIOME_FRAME_INITIALIZATION}`,
    )
    .replace('#include <map_fragment>', LAND_BIOME_MAP_FRAGMENT)
    .replace('#include <roughnessmap_fragment>', LAND_BIOME_ROUGHNESS_FRAGMENT)
    .replace('#include <normal_fragment_maps>', LAND_BIOME_NORMAL_FRAGMENT)
}

/**
 * Samples one small PBR scan through synchronized, randomly rotated triangular
 * cells. Albedo, normal and roughness therefore keep the same local relief,
 * while the source tile can no longer line up into a visible square grid.
 */
export function applyScaleEncounterLandBiomeGroundMaterial(
  material: MeshStandardMaterial,
  options: ScaleEncounterLandBiomeGroundMaterialOptions,
): MeshStandardMaterial {
  if (
    material.userData[LAND_BIOME_GROUND_USER_DATA_KEY] ===
    LAND_BIOME_GROUND_REVISION
  ) {
    return material
  }

  const physicalWidthMeters = Math.max(
    0.25,
    finiteOr(options.physicalWidthMeters, 2),
  )
  const normalFadeStartMeters = Math.max(
    20,
    finiteOr(options.normalFadeStartMeters, 72),
  )
  const resolved = {
    darkTint: new Color(options.darkTint),
    lightTint: new Color(options.lightTint),
    macroVariationStrength: Math.max(
      0,
      Math.min(0.42, finiteOr(options.macroVariationStrength, 0.16)),
    ),
    normalFadeEndMeters: Math.max(
      normalFadeStartMeters + 1,
      finiteOr(options.normalFadeEndMeters, 190),
    ),
    normalFadeStartMeters,
    physicalWidthMeters,
    stochasticCellSizeMeters: Math.max(
      physicalWidthMeters * 1.5,
      finiteOr(options.stochasticCellSizeMeters, physicalWidthMeters * 4.5),
    ),
  }
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material)
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer)
    patchShader(shader, resolved)
  }
  material.customProgramCacheKey = () =>
    `${previousProgramCacheKey()}|${LAND_BIOME_GROUND_REVISION}`
  material.userData[LAND_BIOME_GROUND_USER_DATA_KEY] =
    LAND_BIOME_GROUND_REVISION
  material.needsUpdate = true
  return material
}
