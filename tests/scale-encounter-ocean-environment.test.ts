import {
  BackSide,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Vector3,
  type ShaderMaterial,
} from 'three'
import {
  OCEAN_ENVIRONMENT_LAYERS,
  OCEAN_ENVIRONMENT_VARIANTS,
  OCEAN_GALLERY_WATER_PALETTE,
  createOceanEnvironmentCandidate,
} from '../src/scale-encounter/environments/ocean/ocean-environment-candidate'
import {
  createScaleEncounterEnvironment,
  disposeScaleEncounterEnvironment,
} from '../src/viewer/scale-encounter-environment'

describe('ocean environment candidate', () => {
  it('registers the main-runtime C candidate without seabed or ships', () => {
    const environment = createScaleEncounterEnvironment(
      'water',
      'baseline',
      null,
      { animalId: 'mosasaurus', sceneCandidateVariant: 'C' },
    )
    expect(environment?.sceneCandidateSemantic).toBe('ocean')
    expect(environment?.root.getObjectByName('ocean-world-seabed')).toBeFalsy()
    expect(environment?.root.getObjectByName('ocean-world-ship')).toBeFalsy()
    expect(environment?.root.getObjectByName(
      'ocean-world-incident-light-without-seabed',
    )).toBeFalsy()
    expect(environment?.root.userData.scaleEncounterSceneCandidate).toMatchObject({
      defaultCandidate: false,
      productionApproved: false,
      shipsVisible: false,
      visibleSeabed: false,
    })
    expect(environment?.environmentIntensity).toBe(0.64)
    expect(environment?.toneMappingExposure).toBe(1.18)
    disposeScaleEncounterEnvironment(environment)
  })

  it('keeps A/B/C/D explicit and independently reversible', () => {
    expect(OCEAN_ENVIRONMENT_VARIANTS).toEqual(['A', 'B', 'C', 'D'])
    expect(OCEAN_ENVIRONMENT_LAYERS).toContain('water-surface')
    expect(OCEAN_ENVIRONMENT_LAYERS).toContain('seabed')
    expect(OCEAN_ENVIRONMENT_LAYERS).toContain('ecology-clues')

    const environment = createOceanEnvironmentCandidate({ variant: 'A' })
    expect(environment.getDiagnostics()).toMatchObject({
      fogDensity: 0,
      layers: {
        'background-scatter': true,
        'water-surface': false,
        'water-volume': false,
        seabed: false,
      },
      variant: 'A',
    })

    environment.setVariant('B')
    expect(environment.getDiagnostics()).toMatchObject({
      layers: {
        'background-scatter': true,
        'near-water': false,
        'water-surface': true,
        'water-volume': true,
        seabed: false,
      },
      variant: 'B',
    })
    expect(environment.getFog()?.near).toBe(190)
    expect(environment.getFog()?.far).toBe(560)

    environment.setVariant('C')
    const candidate = environment.getDiagnostics()
    expect(candidate.layers['near-water']).toBe(true)
    expect(candidate.layers['mid-water']).toBe(true)
    expect(candidate.layers['far-volume']).toBe(true)
    expect(candidate.layers.seabed).toBe(false)
    expect(candidate.layers['suspended-particulate']).toBe(true)
    expect(candidate.layers['ecology-clues']).toBe(false)
    expect(candidate.browserIndependentDesignChecks.ecologyFallbackReason).toMatch(
      /No ocean ecology asset is approved/,
    )

    environment.setVariant('D')
    expect(environment.getDiagnostics()).toMatchObject({
      fogFar: null,
      fogModel: 'none',
      fogNear: null,
      naturalnessRevision: 'coherent-gallery-blue-clear-water-v4',
      variant: 'D',
    })
    expect(environment.getFog()).toBeNull()
    const layeredParticles = environment.root.getObjectByName(
      'ocean-layered-depth-particulate',
    )
    expect(layeredParticles?.userData.suspendedParticulateCount).toBe(320)
    expect(layeredParticles?.userData.risingBubbleCount).toBe(60)
    expect(layeredParticles?.userData.bubbleDistribution).toBe(
      'guided-observation-corridors',
    )
    expect(layeredParticles?.userData.currentDirectionXZ).toEqual([
      expect.any(Number),
      expect.any(Number),
    ])
    expect(layeredParticles?.userData.currentSpeedMetersPerSecond).toEqual({
      bubbles: 0.11,
      motes: 0.045,
    })

    environment.setLayerEnabled('suspended-particulate', false)
    expect(
      environment.getDiagnostics().layers['suspended-particulate'],
    ).toBe(false)
    environment.setVariant('A')
    expect(environment.getDiagnostics().variant).toBe('A')
    environment.dispose()
  })

  it('uses world-space interface lighting without additive light cards', () => {
    const environment = createOceanEnvironmentCandidate({ variant: 'C' })
    const diagnostics = environment.getDiagnostics()

    expect(diagnostics.resources.transparentDrawCalls).toBe(1)
    expect(diagnostics.resources.transparentMaterialCount).toBe(1)
    expect(diagnostics.resources.transparentScreenCoverageEstimate).toBeLessThan(
      0.02,
    )
    expect(diagnostics.alpha.cardCount).toBe(0)
    expect(diagnostics.alpha.repeatedCardGroups).toBe(0)
    expect(diagnostics.browserIndependentDesignChecks.repeatedFarCards).toBe(0)
    expect(diagnostics.browserIndependentDesignChecks.colourDiscontinuityBands).toBe(0)
    expect(diagnostics.resources.drawCalls).toBeLessThanOrEqual(8)
    expect(diagnostics.naturalnessRevision).toBe(
      'clear-sunlit-surface-scatter-v12',
    )
    expect(diagnostics.world.waterSurfaceDisplacementMeters).toBe(0.16)
    expect(diagnostics.fogModel).toBe('linear-depth')
    expect(diagnostics.fogNear).toBe(180)
    expect(diagnostics.fogFar).toBe(540)
    // Portrait overview fitting can push a 12 m animal and child to roughly
    // 150 m camera distance. Keep that entire comparison inside the clear
    // water range; depth haze begins only beyond the family-facing corridor.
    expect(diagnostics.fogNear).toBeGreaterThan(150)
    expect(environment.root.getObjectByName(
      'ocean-incident-light-divergent-fan',
    )).toBeFalsy()
    const backdrop = environment.root.getObjectByName(
      'ocean-background-approved-exhibit-reference',
    )
    const surface = environment.root.getObjectByName('ocean-world-water-surface')
    expect(backdrop).toBeInstanceOf(Mesh)
    expect(surface).toBeInstanceOf(Mesh)
    const backdropMaterial = (backdrop as Mesh).material as ShaderMaterial
    const surfaceMaterial = (surface as Mesh).material as ShaderMaterial
    expect(
      (backdropMaterial.uniforms.uDeepColour?.value as { getHexString(): string })
        .getHexString(),
    ).toBe(OCEAN_GALLERY_WATER_PALETTE.deep.slice(1))
    expect(
      (backdropMaterial.uniforms.uHorizonColour?.value as { getHexString(): string })
        .getHexString(),
    ).toBe(OCEAN_GALLERY_WATER_PALETTE.horizon.slice(1))
    expect(
      (backdropMaterial.uniforms.uSurfaceColour?.value as { getHexString(): string })
        .getHexString(),
    ).toBe(OCEAN_GALLERY_WATER_PALETTE.surface.slice(1))
    expect(backdropMaterial.toneMapped).toBe(true)
    expect(backdropMaterial.side).toBe(BackSide)
    expect(surfaceMaterial.toneMapped).toBe(true)
    expect(surfaceMaterial.side).toBe(BackSide)
    expect(backdropMaterial.fragmentShader).toContain('oceanForwardPhase')
    expect(surfaceMaterial.fragmentShader).toContain('refract(')
    expect(surfaceMaterial.fragmentShader).toContain('colorspace_fragment')
    expect(surfaceMaterial.fragmentShader).not.toContain('cellularEdge')
    expect(backdropMaterial.fragmentShader).toContain('oceanDynamicSunShaft')
    const particles = environment.root.getObjectByName(
      'ocean-suspended-particulate-and-rising-bubbles',
    )
    expect(particles?.userData.risingBubbleCount).toBe(48)
    expect(environment.root.getObjectByName(
      'ocean-world-space-animated-volume-shafts',
    )).toBeFalsy()

    const overviewCamera = new PerspectiveCamera(29, 390 / 844, 0.03, 240)
    overviewCamera.position.set(-4, -2, 148)
    environment.update(0, overviewCamera)
    const cameraFill = environment.root.getObjectByName(
      'ocean-camera-side-fill',
    )
    expect(cameraFill).toBeInstanceOf(DirectionalLight)
    expect(cameraFill?.position.toArray()).toEqual([-4, -2, 148])
    expect((cameraFill as DirectionalLight).intensity).toBeCloseTo(2.6)
    expect((cameraFill as DirectionalLight).color.getHexString()).toBe('fff0dc')
    expect((cameraFill as DirectionalLight).target.position.toArray()).toEqual([
      -4,
      -2,
      128,
    ])
    const hemisphere = environment.root.getObjectByName(
      'ocean-surface-to-depth-hemisphere',
    )
    expect(hemisphere).toBeInstanceOf(HemisphereLight)
    expect((hemisphere as HemisphereLight).color.getHexString()).toBe('fff2d8')
    expect((hemisphere as HemisphereLight).groundColor.getHexString()).toBe(
      '526d69',
    )
    expect((hemisphere as HemisphereLight).intensity).toBe(2.35)
    overviewCamera.fov = 60
    environment.update(0, overviewCamera)
    expect((cameraFill as DirectionalLight).intensity).toBe(4.25)
    const surfaceKey = environment.root.getObjectByName('ocean-surface-key')
    expect(surfaceKey).toBeInstanceOf(DirectionalLight)
    const initialSurfaceIntensity = (surfaceKey as DirectionalLight).intensity
    environment.update(3, overviewCamera)
    expect((surfaceKey as DirectionalLight).intensity).not.toBeCloseTo(
      initialSurfaceIntensity,
      4,
    )
    environment.dispose()
  })

  it('diagnoses the frozen subject corridor against an invisible lower boundary', () => {
    const environment = createOceanEnvironmentCandidate({ variant: 'C' })
    environment.setObservationContext({
      animalBounds: new Box3(
        new Vector3(-4.8, -0.7, -1),
        new Vector3(7.2, 3.2, 1),
      ),
      avatarBounds: new Box3(
        new Vector3(-16.9, -7.5, 8.7),
        new Vector3(-16.2, -6.35, 9.2),
      ),
      cameraSamples: [
        { label: 'overview-min', position: new Vector3(1.2, 2.1, 32) },
        { label: 'overview-default', position: new Vector3(1.2, 2.1, 28) },
        { label: 'overview-max', position: new Vector3(1.2, 2.1, 25) },
        { label: 'pov-min', position: new Vector3(-7, -2, 4.7) },
        { label: 'pov-default', position: new Vector3(-15, -6, 9) },
        { label: 'pov-max', position: new Vector3(-21, -8.5, 12.5) },
      ],
    })
    const spatial = environment.getDiagnostics().spatial
    expect(spatial).not.toBeNull()
    expect(spatial?.cameraViolations).toEqual([])
    expect(spatial?.subjectViolations).toEqual([])
    expect(spatial?.corridorOverlapCount).toBe(0)
    expect(spatial?.objectGrounding).toEqual([])
    expect(spatial?.hiddenSeabedBoundary.visibleInCandidate).toBe(false)
    environment.dispose()
  })

  it('accepts only explicitly approved ecology objects and never makes them default', () => {
    const clue = new Group()
    const environment = createOceanEnvironmentCandidate({
      approvedEcologyClues: [
        { id: 'approved-test-clue', object: clue, status: 'approved-for-ocean-slice' },
      ],
      variant: 'B',
    })
    expect(environment.getDiagnostics().layers['ecology-clues']).toBe(false)
    environment.setVariant('C')
    expect(environment.getDiagnostics().layers['ecology-clues']).toBe(false)
    environment.setLayerEnabled('ecology-clues', true)
    expect(environment.getDiagnostics().layers['ecology-clues']).toBe(true)
    expect(environment.getDiagnostics().approvedEcologyAssetIds).toEqual([
      'approved-test-clue',
    ])
    environment.dispose()
  })
})
